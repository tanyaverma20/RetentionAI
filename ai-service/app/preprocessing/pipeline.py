import pandas as pd
import numpy as np
import datetime
from sklearn.preprocessing import StandardScaler, LabelEncoder
from pymongo import MongoClient
from bson import ObjectId

# Keep track of expected features in order
FEATURE_COLS = [
    'age', 
    'gender', 
    'departmentId',
    'designation', 
    'salary', 
    'tenure_months', 
    'years_in_current_role',
    'years_since_last_promotion',
    'training_hours',
    'performance_rating',
    'overtime_hours',
    'distance_from_home',
    'environment_satisfaction',
    'job_satisfaction',
    'work_life_balance',
    'attendance_percentage',
    'leave_count',
    'promotion_count',
    'avg_survey_score',
    'feedback_frequency',
    'employmentType', 
    'workLocation'
]

CATEGORICAL_COLS = ['gender', 'employmentType', 'workLocation', 'designation', 'departmentId']
NUMERICAL_COLS = [
    'age', 'salary', 'tenure_months', 'years_in_current_role', 'years_since_last_promotion',
    'training_hours', 'performance_rating', 'overtime_hours', 'distance_from_home',
    'environment_satisfaction', 'job_satisfaction', 'work_life_balance', 'attendance_percentage',
    'leave_count', 'promotion_count', 'avg_survey_score', 'feedback_frequency'
]

def load_data_from_db(mongo_uri: str, db_name: str) -> pd.DataFrame:
    """
    Loads employee records from MongoDB.
    """
    try:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        db = client[db_name]
        employees = list(db["employees"].find({"isDeleted": {"$ne": True}}))
        if not employees:
            return pd.DataFrame()
        
        df = pd.DataFrame(employees)
        return df
    except Exception as e:
        print(f"MongoDB connection failed: {e}")
        return pd.DataFrame()

def generate_synthetic_data(num_records: int = 1000) -> pd.DataFrame:
    """
    Generates a synthetic DataFrame of employee records with realistic relationships to attrition.
    """
    np.random.seed(42)
    
    # Generate lists
    first_names = [f"First_{i}" for i in range(num_records)]
    last_names = [f"Last_{i}" for i in range(num_records)]
    emails = [f"emp{i}@retentionai.example" for i in range(num_records)]
    
    genders = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]
    employment_types = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]
    locations = ["Office", "Remote", "Hybrid"]
    departments = ["60d5ec388832a828f8000001", "60d5ec388832a828f8000002", "60d5ec388832a828f8000003"]
    designations = ["Engineer", "Senior Engineer", "Manager", "Analyst", "Intern"]
    
    data = []
    current_date = datetime.datetime(2026, 7, 27)
    
    for i in range(num_records):
        gender = np.random.choice(genders, p=[0.45, 0.45, 0.05, 0.05])
        age = int(np.random.randint(21, 60))
        dob = current_date - datetime.timedelta(days=age * 365)
        
        dept = np.random.choice(departments)
        desig = np.random.choice(designations)
        
        tenure_months = int(np.random.randint(1, 120))
        joining_date = current_date - datetime.timedelta(days=tenure_months * 30)
        
        emp_type = np.random.choice(employment_types, p=[0.80, 0.10, 0.08, 0.02])
        
        base_salary = 50000
        if desig == "Senior Engineer":
            base_salary = 90000
        elif desig == "Manager":
            base_salary = 110000
        elif desig == "Intern":
            base_salary = 25000
            
        salary = int(base_salary * np.random.uniform(0.85, 1.25))
        work_loc = np.random.choice(locations)
        
        # Attrition probability
        prob = 0.05
        if salary < 45000:
            prob += 0.25
        if tenure_months < 12:
            prob += 0.20
        if emp_type in ["CONTRACT", "INTERN"]:
            prob += 0.30
        if work_loc == "Office":
            prob += 0.10
            
        prob = max(0.01, min(0.99, prob))
        status = "TERMINATED" if np.random.random() < prob else "ACTIVE"
        
        data.append({
            "_id": str(ObjectId()),
            "employeeCode": f"EMP-{i:04d}",
            "firstName": first_names[i],
            "lastName": last_names[i],
            "email": emails[i],
            "gender": gender,
            "dateOfBirth": dob,
            "departmentId": dept,
            "designation": desig,
            "joiningDate": joining_date,
            "employmentType": emp_type,
            "salary": salary,
            "workLocation": work_loc,
            "status": status,
            "isDeleted": False,
            # Synthesized additional features
            "years_in_current_role": max(0, tenure_months / 12.0 - np.random.uniform(0, 3)),
            "years_since_last_promotion": max(0, tenure_months / 12.0 - np.random.uniform(0, 5)),
            "training_hours": np.random.randint(0, 100),
            "performance_rating": np.random.randint(1, 6),
            "overtime_hours": np.random.randint(0, 50),
            "distance_from_home": np.random.randint(1, 50),
            "environment_satisfaction": np.random.randint(1, 6),
            "job_satisfaction": np.random.randint(1, 6),
            "work_life_balance": np.random.randint(1, 6),
            "attendance_percentage": np.random.uniform(70, 100),
            "leave_count": np.random.randint(0, 30),
            "promotion_count": np.random.randint(0, 4),
            "avg_survey_score": np.random.uniform(1, 5),
            "feedback_frequency": np.random.randint(0, 10)
        })
        
    return pd.DataFrame(data)

def fit_transform_pipeline(df: pd.DataFrame):
    """
    Fits and transforms the dataset for training.
    Returns:
        X_processed: numpy array of processed features
        y: numpy array of target label
        scaler: fitted StandardScaler
        encoders: dict of fitted LabelEncoders
        feature_metadata: dict of feature order and details
    """
    df = df.copy()
    
    # 1. Feature Engineering
    current_date = pd.Timestamp(2026, 7, 27)
    
    # Date variables
    if 'dateOfBirth' in df.columns:
        df['dateOfBirth'] = pd.to_datetime(df['dateOfBirth']).dt.tz_localize(None)
        df['age'] = ((current_date - df['dateOfBirth']).dt.days / 365.25).astype(float)
    else:
        df['age'] = 30.0
        
    if 'joiningDate' in df.columns:
        df['joiningDate'] = pd.to_datetime(df['joiningDate']).dt.tz_localize(None)
        df['tenure_months'] = ((current_date - df['joiningDate']).dt.days / 30.43).astype(float)
    else:
        df['tenure_months'] = 24.0
    
    # 2. Fill missing values
    for col in NUMERICAL_COLS:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors='coerce')
        median_val = df[col].median()
        if pd.isna(median_val):
            median_val = 0.0
        df[col] = df[col].fillna(median_val)
        
    for col in CATEGORICAL_COLS:
        if col not in df.columns:
            df[col] = 'UNKNOWN'
        df[col] = df[col].astype(str).fillna('UNKNOWN')
        
    # 3. Scale numerical features
    scaler = StandardScaler()
    X_num = scaler.fit_transform(df[NUMERICAL_COLS])
    
    # 4. Encode categorical features
    encoders = {}
    X_cat_list = []
    
    for col in CATEGORICAL_COLS:
        le = LabelEncoder()
        # Handle unseen values by adding 'UNKNOWN' to classes
        unique_vals = list(df[col].unique())
        if 'UNKNOWN' not in unique_vals:
            unique_vals.append('UNKNOWN')
        le.fit(unique_vals)
        
        encoded = le.transform(df[col])
        X_cat_list.append(encoded.reshape(-1, 1))
        encoders[col] = le
        
    X_cat = np.hstack(X_cat_list) if X_cat_list else np.empty((len(df), 0))
    
    # Combine numerical and categorical features
    X_processed = np.hstack([X_num, X_cat])
    
    # Target label (1 if TERMINATED or INACTIVE, else 0)
    y = np.zeros(len(df))
    if 'status' in df.columns:
        y = df['status'].apply(lambda x: 1 if str(x).upper() in ['TERMINATED', 'INACTIVE'] else 0).values
        
    feature_metadata = {
        'feature_cols': FEATURE_COLS,
        'numerical_cols': NUMERICAL_COLS,
        'categorical_cols': CATEGORICAL_COLS
    }
    
    return X_processed, y, scaler, encoders, feature_metadata

def transform_inference(df: pd.DataFrame, scaler, encoders):
    """
    Transforms employee records for inference.
    """
    df = df.copy()
    current_date = pd.Timestamp(2026, 7, 27)
    
    # Date variables
    if 'dateOfBirth' in df.columns:
        df['dateOfBirth'] = pd.to_datetime(df['dateOfBirth']).dt.tz_localize(None)
        df['age'] = ((current_date - df['dateOfBirth']).dt.days / 365.25).astype(float)
    else:
        df['age'] = 30.0
        
    if 'joiningDate' in df.columns:
        df['joiningDate'] = pd.to_datetime(df['joiningDate']).dt.tz_localize(None)
        df['tenure_months'] = ((current_date - df['joiningDate']).dt.days / 30.43).astype(float)
    else:
        df['tenure_months'] = 24.0
    
    # 2. Fill missing values
    for col in NUMERICAL_COLS:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors='coerce')
        # Use median from scaler if possible, or 0.0
        df[col] = df[col].fillna(0.0)
        
    for col in CATEGORICAL_COLS:
        if col not in df.columns:
            df[col] = 'UNKNOWN'
        df[col] = df[col].astype(str).fillna('UNKNOWN')
        
    # 3. Scale numerical features
    X_num = scaler.transform(df[NUMERICAL_COLS])
    
    # 4. Encode categorical features
    X_cat_list = []
    for col in CATEGORICAL_COLS:
        le = encoders[col]
        # Map unseen values to 'UNKNOWN'
        classes_set = set(le.classes_)
        mapped_vals = df[col].apply(lambda x: x if x in classes_set else 'UNKNOWN')
        encoded = le.transform(mapped_vals)
        X_cat_list.append(encoded.reshape(-1, 1))
        
    X_cat = np.hstack(X_cat_list) if X_cat_list else np.empty((len(df), 0))
    
    X_processed = np.hstack([X_num, X_cat])
    return X_processed
