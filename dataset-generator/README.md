# RetentionAI Dataset Generator

This modular, production-ready dataset generator generates realistic employee and human resources data for the RetentionAI platform. 

It produces data specifically tailored for the Indian corporate context, enforcing hierarchical structures (CEO \u2192 VP \u2192 Manager \u2192 IC) and maintaining 100% referential integrity across all datasets.

## Requirements
- Node.js (v18+)
- Dependencies: `@faker-js/faker`, `csv-writer`, `dayjs`, `uuid`

## Installation

```bash
cd dataset-generator
npm install
```

## Usage

To generate the datasets, run the orchestrator script:

```bash
node generate.js
```

The script will sequentially generate the files and save them in the `output/` directory. It concludes with a referential integrity check to ensure all `EmployeeID` references map to exactly 1470 unique, valid employees.

## Generated Datasets

1. **departments.csv**: 5 standard departments (Engineering, Sales, Marketing, HR, Finance) with location data.
2. **employees.csv**: Exactly 1470 employees featuring realistic Indian names, monthly INR salaries, job roles, demographics, and hire dates.
3. **attendance.csv**: Generated 6-month historical attendance tracking for all employees, factoring in absenteeism and remote days.
4. **performance_reviews.csv**: Annual performance ratings based on tenure, goals met, and training hours.
5. **employee_surveys.csv**: Multi-date engagement, satisfaction, and work-life balance scores influenced by salary and commute distance.
6. **employee_feedback.csv**: Free-text feedback samples with basic sentiment mapping.
7. **manager_notes.csv**: Private manager observations mapped strictly between valid Manager \u2192 Direct Report relationships.

## Architecture

- `generate.js`: The central entry point.
- `utils/`: Reusable helpers for CSV generation, random value weighting, realistic dates, and final integrity validation.
- `generators/`: Modular scripts per dataset.
- `output/`: The target destination for generated CSV files.
