const { v4: uuidv4 } = require('uuid');

const departmentNames = ['Engineering', 'Sales', 'Marketing', 'Human Resources', 'Finance'];

function generate() {
  const departments = departmentNames.map((name, index) => {
    return {
      DepartmentID: uuidv4(),
      Name: name,
      Code: name.substring(0, 3).toUpperCase() + (index + 1),
      Description: `${name} department for internal operations.`,
      Location: ['Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'][index],
      IsActive: true
    };
  });
  
  return departments;
}

module.exports = { generate };
