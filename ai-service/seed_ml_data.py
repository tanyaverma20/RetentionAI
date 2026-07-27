import os
import random
import datetime
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "retentionai")

print(f"Connecting to MongoDB: {MONGODB_URI}")
print(f"Database: {MONGODB_DB_NAME}")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]

def seed_data():
    # 1. Clear existing synthetic seed data to avoid duplicates if re-run
    # We will keep existing departments if they exist, or create standard ones
    dept_collection = db["departments"]
    emp_collection = db["employees"]
    
    # Pre-populate some departments if none exist
    departments = list(dept_collection.find())
    if not departments:
        print("No departments found. Seeding standard departments...")
        dept_templates = [
            {"code": "ENG", "name": "Engineering", "location": "San Francisco", "costCenter": "CC-ENG", "status": "ACTIVE"},
            {"code": "HR", "name": "Human Resources", "location": "New York", "costCenter": "CC-HR", "status": "ACTIVE"},
            {"code": "SLS", "name": "Sales", "location": "Chicago", "costCenter": "CC-SLS", "status": "ACTIVE"},
            {"code": "MKT", "name": "Marketing", "location": "Chicago", "costCenter": "CC-MKT", "status": "ACTIVE"},
            {"code": "FIN", "name": "Finance", "location": "New York", "costCenter": "CC-FIN", "status": "ACTIVE"}
        ]
        dept_ids = []
        for d in dept_templates:
            d["organizationId"] = ObjectId("60d5ec388832a828f8000000") # standard demo org ID
            res = dept_collection.insert_one(d)
            d["_id"] = res.inserted_id
            dept_ids.append(res.inserted_id)
        departments = list(dept_collection.find())
    else:
        print(f"Found {len(departments)} existing departments.")
        
    dept_ids = [d["_id"] for d in departments]
    dept_codes = {d["_id"]: d["code"] for d in departments}

    print("Generating 1000 synthetic employee records...")
    
    first_names = ["Aarav", "Vihaan", "Aria", "Kabir", "Diya", "Ananya", "Rohan", "Siddharth", "Ishaan", "Neha", 
                   "Emma", "Liam", "Noah", "Olivia", "Ava", "Sophia", "Jackson", "Lucas", "Mia", "Amelia"]
    last_names = ["Sharma", "Verma", "Kumar", "Singh", "Patel", "Mehta", "Joshi", "Gupta", "Rao", "Nair",
                  "Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson"]
    
    designations_by_dept = {
        "ENG": ["Software Engineer", "Senior Engineer", "QA Engineer", "Product Manager", "Tech Lead"],
        "HR": ["HR Coordinator", "HR Specialist", "HR Manager", "Recruiter"],
        "SLS": ["Sales Representative", "Account Executive", "Sales Manager", "Sales Engineer"],
        "MKT": ["Marketing Specialist", "Content Creator", "Marketing Manager", "SEO Specialist"],
        "FIN": ["Financial Analyst", "Accountant", "Finance Manager", "Controller"]
    }
    
    genders = ["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]
    employment_types = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]
    locations = ["Office", "Remote", "Hybrid"]
    
    employees = []
    org_id = ObjectId("60d5ec388832a828f8000000")
    
    # Seed reproducible data
    random.seed(42)
    
    # We will generate 1000 employees. 
    # To simulate attrition, we set status to 'TERMINATED' based on specific feature correlations:
    # High probability of attrition if:
    # - Low salary (e.g. < 40000)
    # - High or low tenure (e.g. tenure < 12 months)
    # - EmploymentType is CONTRACT or INTERN
    # - WorkLocation is Office (people preferring Remote leaving)
    
    for i in range(1, 1001):
        emp_code = f"EMP-{i:04d}"
        first_name = random.choice(first_names)
        last_name = random.choice(last_names)
        email = f"{first_name.lower()}.{last_name.lower()}{i}@retentionai.example"
        phone = f"+1-{random.randint(100, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
        gender = random.choices(genders, weights=[45, 45, 5, 5])[0]
        
        # Age distribution between 21 and 60
        age = random.randint(21, 60)
        birth_year = 2026 - age
        dob = datetime.datetime(birth_year, random.randint(1, 12), random.randint(1, 28))
        
        dept_id = random.choice(dept_ids)
        dept_code = dept_codes[dept_id]
        designation = random.choice(designations_by_dept.get(dept_code, ["Associate"]))
        
        # Tenure distribution (joining date between 1 and 120 months ago)
        tenure_months = random.randint(1, 120)
        joining_date = datetime.datetime(2026, 7, 27) - datetime.timedelta(days=tenure_months * 30)
        
        emp_type = random.choices(employment_types, weights=[80, 10, 8, 2])[0]
        
        # Base salary range depending on department and designation level
        base_salaries = {
            "ENG": 70000, "HR": 50000, "SLS": 55000, "MKT": 52000, "FIN": 65000
        }
        mult = 1.0
        if "Senior" in designation or "Manager" in designation or "Lead" in designation or "Controller" in designation:
            mult = 1.6
        salary = int(base_salaries.get(dept_code, 50000) * mult * random.uniform(0.85, 1.25))
        
        work_location = random.choice(locations)
        
        # Calculate attrition probability based on features
        attrition_prob = 0.05 # Baseline
        
        # 1. Salary impact
        if salary < 50000:
            attrition_prob += 0.25
        elif salary < 85000:
            attrition_prob += 0.10
            
        # 2. Tenure impact (early attrition is higher, late attrition is lower)
        if tenure_months < 12:
            attrition_prob += 0.20
        elif tenure_months < 24:
            attrition_prob += 0.10
        elif tenure_months > 60:
            attrition_prob -= 0.05
            
        # 3. Employment type
        if emp_type in ["CONTRACT", "INTERN"]:
            attrition_prob += 0.30
            
        # 4. Work location
        if work_location == "Office":
            attrition_prob += 0.10
        elif work_location == "Remote":
            attrition_prob -= 0.05
            
        # Bound probability between 0.02 and 0.95
        attrition_prob = max(0.02, min(0.95, attrition_prob))
        
        # Assign status based on probability
        is_terminated = random.random() < attrition_prob
        status = "TERMINATED" if is_terminated else "ACTIVE"
        
        employee_doc = {
            "organizationId": org_id,
            "employeeCode": emp_code,
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "phone": phone,
            "gender": gender,
            "dateOfBirth": dob,
            "departmentId": dept_id,
            "designation": designation,
            "managerId": None, # Will remain null for simplicity
            "joiningDate": joining_date,
            "employmentType": emp_type,
            "salary": salary,
            "workLocation": work_location,
            "status": status,
            "isDeleted": False,
            "createdAt": datetime.datetime.now(),
            "updatedAt": datetime.datetime.now()
        }
        employees.append(employee_doc)
        
    # Bulk insert
    # Let's delete existing synthetic employees to start clean
    delete_res = emp_collection.delete_many({"email": {"$regex": "@retentionai.example$"}})
    print(f"Deleted {delete_res.deleted_count} existing synthetic employee records.")
    
    insert_res = emp_collection.insert_many(employees)
    print(f"Successfully seeded {len(insert_res.inserted_ids)} employee records!")

if __name__ == "__main__":
    seed_data()
