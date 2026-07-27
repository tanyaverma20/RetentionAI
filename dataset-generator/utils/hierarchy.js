// Exact counts to reach 1470 employees
// 1 CEO + 4 VPs + 30 Managers + 1435 ICs = 1470
const TOTAL_EMPLOYEES = 1470;
const HIERARCHY_COUNTS = {
  CEO: 1,
  VP: 4,
  Manager: 30,
  IC: 1435
};

function assignManager(currentIndex, totalCount, hierarchy) {
  // If CEO
  if (currentIndex === 0) return null;
  
  // If VP (indices 1 to 4)
  if (currentIndex >= 1 && currentIndex <= 4) {
    return hierarchy.ceoId; // VP reports to CEO
  }
  
  // If Manager (indices 5 to 34)
  if (currentIndex >= 5 && currentIndex <= 34) {
    const vpIds = hierarchy.vpIds;
    return vpIds[currentIndex % vpIds.length]; // Distribute managers among VPs
  }
  
  // If Individual Contributor (indices 35 to 1469)
  const managerIds = hierarchy.managerIds;
  return managerIds[currentIndex % managerIds.length]; // Distribute ICs among managers
}

function getRoleLevel(index) {
  if (index === 0) return 'CEO';
  if (index >= 1 && index <= 4) return 'VP';
  if (index >= 5 && index <= 34) return 'Manager';
  return 'Employee';
}

function getJobRole(level, departmentName) {
  if (level === 'CEO') return 'Chief Executive Officer';
  if (level === 'VP') return `VP of ${departmentName}`;
  if (level === 'Manager') return `${departmentName} Manager`;
  
  const icRoles = {
    'Engineering': ['Software Engineer', 'Senior Software Engineer', 'DevOps Engineer', 'QA Engineer'],
    'Sales': ['Sales Representative', 'Account Executive', 'Sales Development Rep'],
    'Marketing': ['Marketing Specialist', 'Content Writer', 'SEO Analyst'],
    'Human Resources': ['HR Generalist', 'Recruiter', 'HR Business Partner'],
    'Finance': ['Financial Analyst', 'Accountant', 'Payroll Specialist']
  };
  
  const roles = icRoles[departmentName] || ['Associate', 'Specialist', 'Analyst'];
  return roles[Math.floor(Math.random() * roles.length)];
}

module.exports = {
  TOTAL_EMPLOYEES,
  HIERARCHY_COUNTS,
  assignManager,
  getRoleLevel,
  getJobRole
};
