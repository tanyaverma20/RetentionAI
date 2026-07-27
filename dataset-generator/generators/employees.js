const { faker } = require('@faker-js/faker');
const { v4: uuidv4 } = require('uuid');
const { TOTAL_EMPLOYEES, assignManager, getRoleLevel, getJobRole } = require('../utils/hierarchy');
const { generateHireDate } = require('../utils/dates');
const { getRandomItem, getRandomInt } = require('../utils/random');

// We use the Indian locale for Indian names/locations
faker.locale = 'en_IN';

function generate(departments) {
  const employees = [];
  const hierarchyMap = {
    ceoId: null,
    vpIds: [],
    managerIds: []
  };

  for (let i = 0; i < TOTAL_EMPLOYEES; i++) {
    const roleLevel = getRoleLevel(i);
    const department = getRandomItem(departments);
    
    // Assign ID
    const employeeId = uuidv4();
    
    // Keep track of IDs for hierarchy assignment
    if (roleLevel === 'CEO') hierarchyMap.ceoId = employeeId;
    if (roleLevel === 'VP') hierarchyMap.vpIds.push(employeeId);
    if (roleLevel === 'Manager') hierarchyMap.managerIds.push(employeeId);

    const managerId = assignManager(i, TOTAL_EMPLOYEES, hierarchyMap);
    const jobRole = getJobRole(roleLevel, department.Name);
    
    // Tenure & dates
    const hireDate = generateHireDate();
    
    // Status
    const status = Math.random() > 0.15 ? 'Active' : 'Terminated';
    
    // Salaries in INR (monthly or annual, let's do monthly in INR)
    const baseSalary = roleLevel === 'CEO' ? getRandomInt(500000, 1000000)
                     : roleLevel === 'VP' ? getRandomInt(300000, 500000)
                     : roleLevel === 'Manager' ? getRandomInt(100000, 250000)
                     : getRandomInt(30000, 120000);

    const employee = {
      EmployeeID: employeeId,
      FirstName: faker.person.firstName(),
      LastName: faker.person.lastName(),
      Email: faker.internet.email().toLowerCase(),
      DepartmentID: department.DepartmentID,
      ManagerID: managerId || '',
      JobRole: jobRole,
      HireDate: hireDate,
      Status: status,
      MonthlySalaryINR: baseSalary,
      WorkLocation: department.Location,
      Gender: getRandomItem(['Male', 'Female', 'Non-Binary', 'Prefer not to say']),
      Age: getRandomInt(22, 60),
      DistanceFromHomeKM: getRandomInt(1, 30),
      EducationLevel: getRandomItem(['Bachelors', 'Masters', 'PhD', 'Diploma'])
    };
    
    employees.push(employee);
  }

  return employees;
}

module.exports = { generate };
