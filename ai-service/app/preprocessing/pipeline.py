import pandas as pd
import numpy as np
import datetime
import hashlib
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from pymongo import MongoClient
from bson import ObjectId

# ---------------------------------------------------------------------------
# Feature schema
# ---------------------------------------------------------------------------
# Sprint 8 ML audit finding: the previous feature list included
# distance_from_home / environment_satisfaction / years_in_current_role,
# none of which have any real data source anywhere in this platform's schema
# (no geocoding, no environment-survey dimension, no role-change history) —
# they were always silently defaulted to 0/median in production. They have
# been removed rather than fabricated. In their place: features with a real,
# joinable data source (Attendance/Performance/PromotionHistory/
# TrainingHistory/Survey/EmployeeFeedback collections, plus Sprint 5's NLP
# insights) and genuine engineered signals (promotion gap ratio, salary
# growth, training completion rate, leave frequency).
FEATURE_COLS = [
    'age',
    'gender',
    'departmentId',
    'designation',
    'salary',
    'tenure_months',
    'years_since_last_promotion',
    'promotion_count',
    'promotion_gap_ratio',
    'salary_growth_pct',
    'training_hours',
    'training_completion_rate',
    'performance_rating',
    'overtime_hours',
    'attendance_percentage',
    'leave_count',
    'leave_frequency',
    'job_satisfaction',
    'work_life_balance',
    'avg_survey_score',
    'engagement_score',
    'feedback_frequency',
    'sentiment_score',
    'burnout_score',
    'promotion_frustration_nlp',
    'manager_conflict_nlp',
    'employmentType',
    'workLocation',
]

CATEGORICAL_COLS = ['gender', 'employmentType', 'workLocation', 'designation', 'departmentId']
NUMERICAL_COLS = [
    'age', 'salary', 'tenure_months', 'years_since_last_promotion', 'promotion_count',
    'promotion_gap_ratio', 'salary_growth_pct', 'training_hours', 'training_completion_rate',
    'performance_rating', 'overtime_hours', 'attendance_percentage', 'leave_count',
    'leave_frequency', 'job_satisfaction', 'work_life_balance', 'avg_survey_score',
    'engagement_score', 'feedback_frequency', 'sentiment_score', 'burnout_score',
    'promotion_frustration_nlp', 'manager_conflict_nlp',
]

# Neutral defaults used when a real record simply doesn't exist for an
# employee (e.g. no survey ever taken) — NOT used to fabricate correlation,
# only to avoid crashing on missing sub-collection data.
_NEUTRAL_DEFAULTS = {
    'years_since_last_promotion': 0.0,
    'promotion_count': 0.0,
    'promotion_gap_ratio': 0.0,
    'salary_growth_pct': 0.0,
    'training_hours': 0.0,
    'training_completion_rate': 0.5,
    'performance_rating': 3.0,
    'overtime_hours': 0.0,
    'attendance_percentage': 95.0,
    'leave_count': 0.0,
    'leave_frequency': 0.0,
    'job_satisfaction': 3.0,
    'work_life_balance': 3.0,
    'avg_survey_score': 3.0,
    'engagement_score': 3.0,
    'feedback_frequency': 0.0,
    'sentiment_score': 0.5,
    'burnout_score': 0.3,
    'promotion_frustration_nlp': 0.0,
    'manager_conflict_nlp': 0.0,
}


# ---------------------------------------------------------------------------
# Real-data loading (training) — joins Employee with every HR sub-collection
# that actually tracks these signals, instead of reading only `employees`
# (the Sprint 8 audit finding: 13 of the 17 previous numerical features had
# no source anywhere but the `employees` collection, so real predictions
# always used defaults for most of the feature vector regardless of model
# quality). Uses a synchronous pymongo client — training is an offline,
# one-off script, so this mirrors the existing load_data_from_db's style
# rather than introducing async here.
# ---------------------------------------------------------------------------

def _latest_group(collection, employee_ids, date_field, fields):
    """Returns {employeeId: {field: value}} using the most recent record per employee."""
    if not employee_ids:
        return {}
    pipeline = [
        {"$match": {"employeeId": {"$in": employee_ids}}},
        {"$sort": {date_field: -1}},
        {"$group": {"_id": "$employeeId", **{f: {"$first": f"${f}"} for f in fields}}},
    ]
    return {doc["_id"]: doc for doc in collection.aggregate(pipeline)}


def _aggregate_attendance(db, employee_ids):
    """attendance_percentage, leave_count, overtime_hours from the Attendance collection."""
    if not employee_ids:
        return {}
    pipeline = [
        {"$match": {"employeeId": {"$in": employee_ids}}},
        {"$group": {
            "_id": "$employeeId",
            "totalDays": {"$sum": 1},
            "presentDays": {"$sum": {"$cond": [{"$eq": ["$attendanceStatus", "PRESENT"]}, 1, 0]}},
            "leaveDays": {"$sum": {"$cond": [{"$eq": ["$attendanceStatus", "ON_LEAVE"]}, 1, 0]}},
            "avgOvertimeHours": {"$avg": "$overtimeHours"},
        }},
    ]
    result = {}
    for doc in db["attendances"].aggregate(pipeline):
        total = doc["totalDays"] or 1
        result[doc["_id"]] = {
            "attendance_percentage": (doc["presentDays"] / total) * 100.0,
            "leave_count": float(doc["leaveDays"]),
            "overtime_hours": float(doc.get("avgOvertimeHours") or 0.0),
        }
    return result


def _aggregate_performance(db, employee_ids):
    """performance_rating from the most recent Performance review."""
    latest = _latest_group(db["performances"], employee_ids, "reviewPeriod", ["performanceScore"])
    return {k: {"performance_rating": float(v.get("performanceScore") or 3.0)} for k, v in latest.items()}


def _aggregate_promotions(db, employee_ids):
    """years_since_last_promotion, promotion_count, salary_growth_pct, promotion_gap_ratio."""
    if not employee_ids:
        return {}
    now = pd.Timestamp.now()
    pipeline = [
        {"$match": {"employeeId": {"$in": employee_ids}}},
        {"$group": {
            "_id": "$employeeId",
            "count": {"$sum": 1},
            "lastPromotionDate": {"$max": "$promotionDate"},
            "totalSalaryIncreasePct": {"$sum": "$salaryIncreasePercentage"},
        }},
    ]
    result = {}
    for doc in db["promotionhistories"].aggregate(pipeline):
        last_promo = pd.to_datetime(doc.get("lastPromotionDate"))
        years_since = (now - last_promo).days / 365.25 if last_promo is not None and not pd.isna(last_promo) else None
        result[doc["_id"]] = {
            "promotion_count": float(doc["count"]),
            "years_since_last_promotion": years_since,  # filled in per-employee against tenure if None
            "salary_growth_pct": float(doc.get("totalSalaryIncreasePct") or 0.0),
        }
    return result


def _aggregate_training(db, employee_ids):
    """training_hours (total), training_completion_rate (certified / total)."""
    if not employee_ids:
        return {}
    pipeline = [
        {"$match": {"employeeId": {"$in": employee_ids}}},
        {"$group": {
            "_id": "$employeeId",
            "totalHours": {"$sum": "$durationHours"},
            "count": {"$sum": 1},
            "certified": {"$sum": {"$cond": ["$certificationEarned", 1, 0]}},
        }},
    ]
    result = {}
    for doc in db["traininghistories"].aggregate(pipeline):
        total = doc["count"] or 1
        result[doc["_id"]] = {
            "training_hours": float(doc.get("totalHours") or 0.0),
            "training_completion_rate": doc["certified"] / total,
        }
    return result


def _aggregate_surveys(db, employee_ids):
    """job_satisfaction, work_life_balance, engagement_score, avg_survey_score from the latest Survey."""
    fields = [
        "jobSatisfaction", "workLifeBalance", "engagementScore", "careerGrowthScore",
        "managerRelationshipScore", "recognition", "compensationSatisfaction", "overallHappiness",
    ]
    latest = _latest_group(db["surveys"], employee_ids, "surveyDate", fields)
    result = {}
    for k, v in latest.items():
        dims = [v.get(f) for f in [
            "engagementScore", "careerGrowthScore", "managerRelationshipScore",
            "recognition", "compensationSatisfaction", "overallHappiness",
        ] if v.get(f) is not None]
        result[k] = {
            "job_satisfaction": float(v.get("jobSatisfaction") or 3.0),
            "work_life_balance": float(v.get("workLifeBalance") or 3.0),
            "engagement_score": float(v.get("engagementScore") or 3.0),
            "avg_survey_score": float(np.mean(dims)) if dims else 3.0,
        }
    return result


def _aggregate_feedback(db, employee_ids):
    """feedback_frequency = count of EmployeeFeedback entries per employee."""
    if not employee_ids:
        return {}
    pipeline = [
        {"$match": {"employeeId": {"$in": employee_ids}}},
        {"$group": {"_id": "$employeeId", "count": {"$sum": 1}}},
    ]
    return {doc["_id"]: {"feedback_frequency": float(doc["count"])} for doc in db["employeefeedbacks"].aggregate(pipeline)}


def _aggregate_nlp_insights(db, employee_id_strs):
    """
    sentiment_score, burnout_score, promotion_frustration_nlp, manager_conflict_nlp
    from Sprint 5's NLP output (FastAPI's own `nlp_insights` collection —
    reused read-only here, no NLP code touched). employeeId is stored as a
    string in this collection (unlike the Mongoose ObjectId collections
    above), since FastAPI receives IDs as JSON strings from Node.
    """
    if not employee_id_strs:
        return {}
    fields = ["sentimentScore", "burnoutRisk", "promotionFrustration", "managerConflict"]
    latest = _latest_group(db["nlp_insights"], employee_id_strs, "generatedAt", fields)
    result = {}
    for k, v in latest.items():
        result[k] = {
            "sentiment_score": float(v.get("sentimentScore")) if v.get("sentimentScore") is not None else 0.5,
            "burnout_score": float(v.get("burnoutRisk")) if v.get("burnoutRisk") is not None else 0.3,
            "promotion_frustration_nlp": float(v.get("promotionFrustration") or 0.0),
            "manager_conflict_nlp": float(v.get("managerConflict") or 0.0),
        }
    return result


def load_data_from_db(mongo_uri: str, db_name: str) -> pd.DataFrame:
    """
    Loads employee records from MongoDB, enriched with real signals joined
    from Attendance, Performance, PromotionHistory, TrainingHistory, Survey,
    EmployeeFeedback, and Sprint 5's NLP insights. Employees with no record
    in a given sub-collection fall back to a documented neutral default
    (_NEUTRAL_DEFAULTS) rather than a fabricated value.
    """
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        db = client[db_name]
        employees = list(db["employees"].find({"isDeleted": {"$ne": True}}))
        if not employees:
            return pd.DataFrame()

        df = pd.DataFrame(employees)
        employee_ids = list(df["_id"])
        employee_id_strs = [str(i) for i in employee_ids]

        attendance = _aggregate_attendance(db, employee_ids)
        performance = _aggregate_performance(db, employee_ids)
        promotions = _aggregate_promotions(db, employee_ids)
        training = _aggregate_training(db, employee_ids)
        surveys = _aggregate_surveys(db, employee_ids)
        feedback = _aggregate_feedback(db, employee_ids)
        nlp = _aggregate_nlp_insights(db, employee_id_strs)

        def _lookup(sources, eid, eid_str, field):
            for src in sources:
                key = eid if eid in src else (eid_str if eid_str in src else None)
                if key is not None and field in src.get(key, {}) and src[key][field] is not None:
                    return src[key][field]
            return _NEUTRAL_DEFAULTS.get(field)

        enriched_rows = []
        for _id, joining_date in zip(df["_id"], df.get("joiningDate", [None] * len(df))):
            eid, eid_str = _id, str(_id)
            tenure_years = None
            if joining_date is not None and not pd.isna(joining_date):
                tenure_years = max((pd.Timestamp.now() - pd.to_datetime(joining_date)).days / 365.25, 0.01)

            promo = promotions.get(eid, {})
            years_since_promo = promo.get("years_since_last_promotion")
            if years_since_promo is None:
                # No promotion on record — treat "time since joining" as the
                # promotion gap (never been promoted at all).
                years_since_promo = tenure_years if tenure_years is not None else _NEUTRAL_DEFAULTS['years_since_last_promotion']
            promo_gap_ratio = (years_since_promo / tenure_years) if tenure_years and tenure_years > 0 else 0.0

            leave_count = _lookup([attendance], eid, eid_str, "leave_count")
            leave_frequency = (leave_count / tenure_years) if tenure_years and tenure_years > 0 else 0.0

            row = {
                "attendance_percentage": _lookup([attendance], eid, eid_str, "attendance_percentage"),
                "leave_count": leave_count,
                "leave_frequency": leave_frequency,
                "overtime_hours": _lookup([attendance], eid, eid_str, "overtime_hours"),
                "performance_rating": _lookup([performance], eid, eid_str, "performance_rating"),
                "promotion_count": promo.get("promotion_count", _NEUTRAL_DEFAULTS['promotion_count']),
                "years_since_last_promotion": years_since_promo,
                "promotion_gap_ratio": promo_gap_ratio,
                "salary_growth_pct": promo.get("salary_growth_pct", _NEUTRAL_DEFAULTS['salary_growth_pct']),
                "training_hours": _lookup([training], eid, eid_str, "training_hours"),
                "training_completion_rate": _lookup([training], eid, eid_str, "training_completion_rate"),
                "job_satisfaction": _lookup([surveys], eid, eid_str, "job_satisfaction"),
                "work_life_balance": _lookup([surveys], eid, eid_str, "work_life_balance"),
                "engagement_score": _lookup([surveys], eid, eid_str, "engagement_score"),
                "avg_survey_score": _lookup([surveys], eid, eid_str, "avg_survey_score"),
                "feedback_frequency": _lookup([feedback], eid, eid_str, "feedback_frequency"),
                "sentiment_score": _lookup([nlp], eid, eid_str, "sentiment_score"),
                "burnout_score": _lookup([nlp], eid, eid_str, "burnout_score"),
                "promotion_frustration_nlp": _lookup([nlp], eid, eid_str, "promotion_frustration_nlp"),
                "manager_conflict_nlp": _lookup([nlp], eid, eid_str, "manager_conflict_nlp"),
            }
            enriched_rows.append(row)

        enriched_df = pd.DataFrame(enriched_rows, index=df.index)
        return pd.concat([df, enriched_df], axis=1)
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return pd.DataFrame()


def load_ibm_attrition_csv(csv_path: str) -> pd.DataFrame:
    """
    Loads the public IBM HR Analytics Employee Attrition & Performance dataset
    (standard Kaggle column layout, e.g. WA_Fn-UseC_-HR-Employee-Attrition.csv)
    and maps its columns onto this project's internal employee feature schema.

    IBM columns not covered by this dataset (salary growth %, training
    completion rate, leave frequency, sentiment/burnout/engagement scores —
    signals this platform derives from its own Attendance/Survey/NLP
    modules that the IBM CSV has no equivalent for) are intentionally left
    unset; fit_transform_pipeline fills the documented neutral default.
    """
    raw = pd.read_csv(csv_path)
    n = len(raw)

    required = {'Attrition', 'Age', 'MonthlyIncome', 'YearsAtCompany'}
    missing = required - set(raw.columns)
    if missing:
        raise ValueError(
            f"CSV is missing expected IBM HR Attrition columns: {sorted(missing)}"
        )

    def col(name, default):
        if name in raw.columns:
            return raw[name]
        return pd.Series([default] * n, index=raw.index)

    df = pd.DataFrame(index=raw.index)
    df['age'] = raw['Age'].astype(float)
    df['gender'] = col('Gender', 'UNKNOWN').astype(str).str.upper()
    df['departmentId'] = col('Department', 'UNKNOWN').astype(str)
    df['designation'] = col('JobRole', 'UNKNOWN').astype(str)
    df['salary'] = raw['MonthlyIncome'].astype(float) * 12
    df['tenure_months'] = raw['YearsAtCompany'].astype(float) * 12
    tenure_years = (df['tenure_months'] / 12.0).clip(lower=0.01)
    df['years_since_last_promotion'] = col('YearsSinceLastPromotion', 0).astype(float)
    df['promotion_gap_ratio'] = df['years_since_last_promotion'] / tenure_years
    df['promotion_count'] = col('YearsAtCompany', 0).astype(float).apply(lambda y: 1.0 if y > 2 else 0.0)
    df['salary_growth_pct'] = col('PercentSalaryHike', 0).astype(float)
    # IBM reports training *sessions* per year, not hours — scaled as an approximate proxy.
    df['training_hours'] = col('TrainingTimesLastYear', 0).astype(float) * 8
    df['training_completion_rate'] = 0.5
    df['performance_rating'] = col('PerformanceRating', 3).astype(float)
    # IBM's OverTime is a Yes/No flag, not hours — mapped to an approximate proxy.
    df['overtime_hours'] = col('OverTime', 'No').map({'Yes': 15, 'No': 0}).fillna(0).astype(float)
    df['attendance_percentage'] = 95.0
    df['leave_count'] = 0.0
    df['leave_frequency'] = 0.0
    df['job_satisfaction'] = col('JobSatisfaction', 3).astype(float)
    df['work_life_balance'] = col('WorkLifeBalance', 3).astype(float)
    df['engagement_score'] = col('EnvironmentSatisfaction', 3).astype(float)  # closest available IBM proxy
    df['avg_survey_score'] = df[['job_satisfaction', 'work_life_balance', 'engagement_score']].mean(axis=1)
    df['feedback_frequency'] = 0.0
    df['sentiment_score'] = 0.5
    df['burnout_score'] = 0.3
    df['promotion_frustration_nlp'] = 0.0
    df['manager_conflict_nlp'] = 0.0
    df['status'] = raw['Attrition'].astype(str).map({'Yes': 'TERMINATED', 'No': 'ACTIVE'}).fillna('ACTIVE')

    return df


def generate_synthetic_data(num_records: int = 5000) -> pd.DataFrame:
    """
    Generates a synthetic DataFrame of employee records whose attrition label
    is a genuine function of ALL modeled features (not just salary/tenure/
    employment-type/work-location, as the previous generator did — see the
    Sprint 8 ML audit, which measured near-zero correlation between the old
    label and job_satisfaction/work_life_balance/overtime/performance/
    promotion-gap/sentiment/burnout, explaining why extreme high-risk
    profiles previously scored LOW). Each employee's underlying "risk
    factors" are drawn first, the label is derived from a noisy weighted
    combination of them (logistic latent-utility model), and the same
    factors then drive the visible feature values — so features and label
    are consistently generated from shared latent risk, and the label is
    never a deterministic function of any single feature (avoiding leakage).
    """
    rng = np.random.default_rng(42)
    n = num_records

    genders = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]
    employment_types = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]
    locations = ["Office", "Remote", "Hybrid"]
    departments = ["60d5ec388832a828f8000001", "60d5ec388832a828f8000002", "60d5ec388832a828f8000003"]
    designations = ["Engineer", "Senior Engineer", "Manager", "Analyst", "Intern"]

    gender = rng.choice(genders, size=n, p=[0.45, 0.45, 0.05, 0.05])
    age = rng.integers(21, 60, size=n).astype(float)
    dept = rng.choice(departments, size=n)
    desig = rng.choice(designations, size=n)
    emp_type = rng.choice(employment_types, size=n, p=[0.80, 0.10, 0.08, 0.02])
    tenure_months = rng.integers(1, 121, size=n).astype(float)
    tenure_years = tenure_months / 12.0

    base_salary = np.select(
        [desig == "Senior Engineer", desig == "Manager", desig == "Intern"],
        [90000.0, 110000.0, 25000.0], default=50000.0,
    )
    salary = base_salary * rng.uniform(0.85, 1.25, size=n)

    years_since_promo = np.clip(tenure_years - rng.uniform(0, 5, size=n), 0, None)
    promo_gap_ratio = years_since_promo / np.clip(tenure_years, 0.5, None)
    promotion_count = rng.integers(0, 4, size=n).astype(float)
    salary_growth_pct = promotion_count * rng.uniform(5, 15, size=n)

    training_hours = rng.integers(0, 100, size=n).astype(float)
    training_completion_rate = rng.uniform(0.2, 1.0, size=n)
    performance_rating = rng.integers(1, 6, size=n).astype(float)
    overtime_hours = rng.integers(0, 50, size=n).astype(float)
    attendance_percentage = rng.uniform(70, 100, size=n)
    leave_count = rng.integers(0, 30, size=n).astype(float)
    leave_frequency = leave_count / np.clip(tenure_years, 0.5, None)
    job_satisfaction = rng.integers(1, 6, size=n).astype(float)
    work_life_balance = rng.integers(1, 6, size=n).astype(float)
    engagement_score = rng.integers(1, 6, size=n).astype(float)
    avg_survey_score = (job_satisfaction + work_life_balance + engagement_score) / 3.0
    feedback_frequency = rng.integers(0, 10, size=n).astype(float)
    sentiment_score = np.clip((job_satisfaction + engagement_score) / 10.0 + rng.normal(0, 0.1, size=n), 0, 1)
    burnout_score = np.clip((overtime_hours / 50.0) * 0.5 + (1 - work_life_balance / 5.0) * 0.5 + rng.normal(0, 0.1, size=n), 0, 1)
    promotion_frustration_nlp = np.clip(promo_gap_ratio / 3.0 + rng.normal(0, 0.1, size=n), 0, 1)
    manager_conflict_nlp = np.clip(rng.uniform(0, 1, size=n) * 0.3 + (1 - job_satisfaction / 5.0) * 0.2, 0, 1)

    # Standardize each risk driver so weights below are directly comparable,
    # then combine into a logistic latent-utility score. Positive weight =
    # increases attrition risk; negative weight = protective.
    def z(x):
        std = x.std()
        return (x - x.mean()) / std if std > 0 else np.zeros_like(x)

    logit = (
        - 0.55 * z(salary)
        - 0.35 * z(tenure_months)
        - 0.70 * z(job_satisfaction)
        - 0.65 * z(work_life_balance)
        - 0.60 * z(engagement_score)
        - 0.55 * z(sentiment_score)
        + 0.75 * z(burnout_score)
        + 0.60 * z(promo_gap_ratio)
        + 0.50 * z(promotion_frustration_nlp)
        + 0.45 * z(manager_conflict_nlp)
        + 0.35 * z(overtime_hours)
        + 0.25 * z(leave_frequency)
        - 0.15 * z(performance_rating)
        - 0.15 * z(training_completion_rate)
        + 0.30 * (emp_type == "CONTRACT").astype(float)
        + 0.45 * (emp_type == "INTERN").astype(float)
        + rng.normal(0, 0.6, size=n)  # irreducible noise — labels are never a deterministic function of features
    )
    # Calibrate intercept so the base attrition rate lands near real-world
    # benchmarks (~16-20%, matching the IBM HR Attrition dataset's ~16%).
    intercept = -2.6
    prob = 1.0 / (1.0 + np.exp(-(intercept + logit)))
    status = np.where(rng.random(n) < prob, "TERMINATED", "ACTIVE")

    current_date = datetime.datetime.now()
    dob = [current_date - datetime.timedelta(days=int(a * 365.25)) for a in age]
    joining_date = [current_date - datetime.timedelta(days=int(t * 30.43)) for t in tenure_months]

    df = pd.DataFrame({
        "_id": [str(ObjectId()) for _ in range(n)],
        "employeeCode": [f"EMP-{i:04d}" for i in range(n)],
        "firstName": [f"First_{i}" for i in range(n)],
        "lastName": [f"Last_{i}" for i in range(n)],
        "email": [f"emp{i}@retentionai.example" for i in range(n)],
        "gender": gender,
        "dateOfBirth": dob,
        "departmentId": dept,
        "designation": desig,
        "joiningDate": joining_date,
        "employmentType": emp_type,
        "salary": salary,
        "workLocation": rng.choice(locations, size=n),
        "status": status,
        "isDeleted": False,
        "years_since_last_promotion": years_since_promo,
        "promotion_gap_ratio": promo_gap_ratio,
        "promotion_count": promotion_count,
        "salary_growth_pct": salary_growth_pct,
        "training_hours": training_hours,
        "training_completion_rate": training_completion_rate,
        "performance_rating": performance_rating,
        "overtime_hours": overtime_hours,
        "attendance_percentage": attendance_percentage,
        "leave_count": leave_count,
        "leave_frequency": leave_frequency,
        "job_satisfaction": job_satisfaction,
        "work_life_balance": work_life_balance,
        "engagement_score": engagement_score,
        "avg_survey_score": avg_survey_score,
        "feedback_frequency": feedback_frequency,
        "sentiment_score": sentiment_score,
        "burnout_score": burnout_score,
        "promotion_frustration_nlp": promotion_frustration_nlp,
        "manager_conflict_nlp": manager_conflict_nlp,
    })

    return df


def validate_dataset_schema(df: pd.DataFrame, is_training: bool = True) -> tuple[bool, list[str]]:
    """
    Validates dataset structural integrity, column presence, missingness bounds,
    and value ranges prior to pipeline execution. Returns (is_valid, list_of_issues).
    """
    issues = []
    if df is None or len(df) == 0:
        return False, ["Dataset is empty or None."]

    if is_training and len(df) < 20:
        issues.append(f"Insufficient training records: {len(df)} rows provided (minimum 20 required).")

    # Target class check for training
    if is_training:
        if "status" not in df.columns:
            issues.append("Required target column 'status' is missing from training dataset.")
        else:
            y = df["status"].apply(lambda x: 1 if str(x).upper() in ["TERMINATED", "INACTIVE"] else 0).values
            unique_classes = np.unique(y)
            if len(unique_classes) < 2:
                issues.append("Training dataset contains only one target class; both active and terminated samples are required.")
            else:
                minority_count = min(np.sum(y == 0), np.sum(y == 1))
                if minority_count < 2:
                    issues.append(f"Minority class has only {minority_count} sample(s); at least 2 required for stratified evaluation.")

    # Range checks on available numerical features
    if "age" in df.columns:
        ages = pd.to_numeric(df["age"], errors="coerce").dropna()
        if len(ages) > 0 and ((ages < 16) | (ages > 100)).any():
            issues.append("Detected out-of-range employee age values (<16 or >100 years).")

    if "salary" in df.columns:
        salaries = pd.to_numeric(df["salary"], errors="coerce").dropna()
        if len(salaries) > 0 and (salaries < 0).any():
            issues.append("Detected negative salary values.")

    if "attendance_percentage" in df.columns:
        att = pd.to_numeric(df["attendance_percentage"], errors="coerce").dropna()
        if len(att) > 0 and ((att < 0) | (att > 100)).any():
            issues.append("Detected attendance percentages outside the [0, 100]% bounds.")

    # Missingness check
    missing_pct = df.isnull().mean()
    high_missing_cols = missing_pct[missing_pct > 0.6].index.tolist()
    if high_missing_cols:
        issues.append(f"High missingness (>60%) detected in columns: {', '.join(high_missing_cols)}")

    is_valid = len(issues) == 0
    return is_valid, issues


def compute_dataset_fingerprint(df: pd.DataFrame) -> str:
    """
    Computes a deterministic SHA-256 fingerprint for a dataset based on
    sorted columns, shape, and content summary hash.
    """
    hasher = hashlib.sha256()
    col_str = ",".join(sorted(df.columns.astype(str)))
    hasher.update(col_str.encode("utf-8"))
    hasher.update(f"{df.shape[0]}x{df.shape[1]}".encode("utf-8"))
    # Hash deterministic sample subset
    sample_df = pd.concat([df.head(5), df.tail(5)]) if len(df) > 10 else df
    content_str = sample_df.to_csv(index=False)
    hasher.update(content_str.encode("utf-8"))
    return hasher.hexdigest()


def _engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Vectorized feature engineering WITHOUT imputation. Derives age from dateOfBirth,
    tenure from joiningDate, and ensures expected columns exist with correct types.
    Median imputation is deliberately omitted here to prevent test-to-train leakage.
    """
    df = df.copy()
    current_date = pd.Timestamp.now()

    if 'age' not in df.columns:
        if 'dateOfBirth' in df.columns:
            df['dateOfBirth'] = pd.to_datetime(df['dateOfBirth']).dt.tz_localize(None)
            df['age'] = ((current_date - df['dateOfBirth']).dt.days / 365.25).astype(float)
        else:
            df['age'] = 30.0
    else:
        df['age'] = pd.to_numeric(df['age'], errors='coerce')

    if 'tenure_months' not in df.columns:
        if 'joiningDate' in df.columns:
            df['joiningDate'] = pd.to_datetime(df['joiningDate']).dt.tz_localize(None)
            df['tenure_months'] = ((current_date - df['joiningDate']).dt.days / 30.43).astype(float)
        else:
            df['tenure_months'] = 24.0
    else:
        df['tenure_months'] = pd.to_numeric(df['tenure_months'], errors='coerce')

    for col in NUMERICAL_COLS:
        if col not in df.columns:
            df[col] = _NEUTRAL_DEFAULTS.get(col, 0.0)
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce')

    for col in CATEGORICAL_COLS:
        if col not in df.columns:
            df[col] = 'UNKNOWN'
        else:
            df[col] = df[col].astype(str)

    return df


def _apply_imputation(df: pd.DataFrame, imputer_values: dict = None) -> pd.DataFrame:
    """
    Imputes numerical missing values using strictly supplied imputer_values
    (computed on training split), falling back to documented neutral defaults.
    """
    df = df.copy()
    imputer = imputer_values or {}

    for col in NUMERICAL_COLS:
        fallback = imputer.get(col, _NEUTRAL_DEFAULTS.get(col, 0.0))
        df[col] = df[col].fillna(fallback)

    for col in CATEGORICAL_COLS:
        df[col] = df[col].fillna('UNKNOWN').replace({'nan': 'UNKNOWN', 'None': 'UNKNOWN', '': 'UNKNOWN'})

    return df


def _engineer_and_impute(df: pd.DataFrame, imputer_values: dict = None) -> pd.DataFrame:
    """
    Backward-compatible helper: engineers features and applies imputation.
    When imputer_values is None, uses neutral defaults/per-column defaults.
    """
    df = _engineer_features(df)
    return _apply_imputation(df, imputer_values)


def fit_transform_pipeline(df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42):
    """
    Leakage-Safe Preprocessing Pipeline:
    1. Derives features without imputation.
    2. Splits into train and test sets BEFORE computing any statistics.
    3. Fits median imputers, StandardScaler, and LabelEncoders strictly on df_train.
    4. Transforms both partitions using the training-derived statistics.

    Returns:
        X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata
    """
    # 1. Feature Engineering (without imputation)
    df_engineered = _engineer_features(df)

    y = np.zeros(len(df_engineered))
    if 'status' in df_engineered.columns:
        y = df_engineered['status'].apply(lambda x: 1 if str(x).upper() in ['TERMINATED', 'INACTIVE'] else 0).values

    # 2. Stratified Train / Test Split
    if len(set(y)) < 2:
        train_idx, test_idx = train_test_split(np.arange(len(df_engineered)), test_size=test_size, random_state=random_state)
    else:
        train_idx, test_idx = train_test_split(np.arange(len(df_engineered)), test_size=test_size, stratify=y, random_state=random_state)

    df_train_raw = df_engineered.iloc[train_idx].copy()
    df_test_raw = df_engineered.iloc[test_idx].copy()
    y_train = y[train_idx]
    y_test = y[test_idx]

    # 3. Compute Training Imputation Medians Strictly on Train Split (No Leakage)
    train_imputer_values = {}
    for col in NUMERICAL_COLS:
        med = df_train_raw[col].median()
        train_imputer_values[col] = float(med) if not pd.isna(med) else _NEUTRAL_DEFAULTS.get(col, 0.0)

    # 4. Apply Training Imputer to both Train and Test
    df_train = _apply_imputation(df_train_raw, train_imputer_values)
    df_test = _apply_imputation(df_test_raw, train_imputer_values)

    # 5. Fit Scaler strictly on df_train
    scaler = StandardScaler()
    scaler.fit(df_train[NUMERICAL_COLS])

    # 6. Fit Encoders strictly on df_train (ensuring UNKNOWN is supported)
    encoders = {}
    for col in CATEGORICAL_COLS:
        le = LabelEncoder()
        unique_vals = list(df_train[col].unique())
        if 'UNKNOWN' not in unique_vals:
            unique_vals.append('UNKNOWN')
        le.fit(unique_vals)
        encoders[col] = le

    # 7. Apply Transformation
    X_train = _apply_transform(df_train, scaler, encoders)
    X_test = _apply_transform(df_test, scaler, encoders)

    feature_metadata = {
        'feature_cols': FEATURE_COLS,
        'numerical_cols': NUMERICAL_COLS,
        'categorical_cols': CATEGORICAL_COLS,
        'imputer_values': train_imputer_values,
        'dataset_fingerprint': compute_dataset_fingerprint(df),
        'train_samples': len(df_train),
        'test_samples': len(df_test),
        'positive_class_ratio': float(np.mean(y_train)),
    }

    return X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata


def fit_transform_split(df: pd.DataFrame, test_size: float = 0.15, val_size: float = 0.15, random_state: int = 42):
    """
    3-Way Stratified Split Pipeline:
    Splits dataset into Train (e.g. 70%), Validation (15%), and Test (15%) partitions.
    All preprocessing parameters (medians, scaling, encoding) are fit STRICTLY on Train.
    Validation and Test are transformed with zero leakage.

    Returns:
        X_train, X_val, X_test, y_train, y_val, y_test, scaler, encoders, feature_metadata
    """
    df_engineered = _engineer_features(df)

    y = np.zeros(len(df_engineered))
    if 'status' in df_engineered.columns:
        y = df_engineered['status'].apply(lambda x: 1 if str(x).upper() in ['TERMINATED', 'INACTIVE'] else 0).values

    # First split off untouched test set
    strat = y if len(set(y)) >= 2 else None
    train_val_idx, test_idx = train_test_split(np.arange(len(df_engineered)), test_size=test_size, stratify=strat, random_state=random_state)

    df_train_val = df_engineered.iloc[train_val_idx]
    y_train_val = y[train_val_idx]

    # Second split: separate validation from train
    rel_val_size = val_size / (1.0 - test_size)
    strat_tv = y_train_val if len(set(y_train_val)) >= 2 else None
    train_idx, val_idx = train_test_split(np.arange(len(df_train_val)), test_size=rel_val_size, stratify=strat_tv, random_state=random_state)

    df_train_raw = df_train_val.iloc[train_idx].copy()
    df_val_raw = df_train_val.iloc[val_idx].copy()
    df_test_raw = df_engineered.iloc[test_idx].copy()

    y_train = y_train_val[train_idx]
    y_val = y_train_val[val_idx]
    y_test = y[test_idx]

    # Compute medians strictly on Train
    train_imputer_values = {
        col: float(df_train_raw[col].median()) if not pd.isna(df_train_raw[col].median()) else _NEUTRAL_DEFAULTS.get(col, 0.0)
        for col in NUMERICAL_COLS
    }

    df_train = _apply_imputation(df_train_raw, train_imputer_values)
    df_val = _apply_imputation(df_val_raw, train_imputer_values)
    df_test = _apply_imputation(df_test_raw, train_imputer_values)

    scaler = StandardScaler()
    scaler.fit(df_train[NUMERICAL_COLS])

    encoders = {}
    for col in CATEGORICAL_COLS:
        le = LabelEncoder()
        unique_vals = list(df_train[col].unique())
        if 'UNKNOWN' not in unique_vals:
            unique_vals.append('UNKNOWN')
        le.fit(unique_vals)
        encoders[col] = le

    X_train = _apply_transform(df_train, scaler, encoders)
    X_val = _apply_transform(df_val, scaler, encoders)
    X_test = _apply_transform(df_test, scaler, encoders)

    feature_metadata = {
        'feature_cols': FEATURE_COLS,
        'numerical_cols': NUMERICAL_COLS,
        'categorical_cols': CATEGORICAL_COLS,
        'imputer_values': train_imputer_values,
        'dataset_fingerprint': compute_dataset_fingerprint(df),
        'train_samples': len(df_train),
        'val_samples': len(df_val),
        'test_samples': len(df_test),
        'positive_class_ratio': float(np.mean(y_train)),
    }

    return X_train, X_val, X_test, y_train, y_val, y_test, scaler, encoders, feature_metadata


def _apply_transform(df: pd.DataFrame, scaler, encoders) -> np.ndarray:
    """Scales/encodes an already-engineered+imputed dataframe. Shared by training,
    validation, and inference — the single source of truth for turning a feature
    dataframe into the model's input matrix."""
    X_num = scaler.transform(df[NUMERICAL_COLS])

    X_cat_list = []
    for col in CATEGORICAL_COLS:
        le = encoders[col]
        classes_set = set(le.classes_)
        mapped_vals = df[col].apply(lambda x: x if x in classes_set else 'UNKNOWN')
        encoded = le.transform(mapped_vals)
        X_cat_list.append(encoded.reshape(-1, 1))

    X_cat = np.hstack(X_cat_list) if X_cat_list else np.empty((len(df), 0))
    return np.hstack([X_num, X_cat])


def transform_inference(df: pd.DataFrame, scaler, encoders, imputer_values: dict = None) -> np.ndarray:
    """Transforms employee records for inference — reuses the exact same
    engineering/imputation/scaling/encoding path as training with zero train/serve skew."""
    df_engineered = _engineer_features(df)
    df_imputed = _apply_imputation(df_engineered, imputer_values)
    return _apply_transform(df_imputed, scaler, encoders)

