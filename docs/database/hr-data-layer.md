# HR Collections Data Architecture

This document outlines the HR data collections implemented in RetentionAI to support advanced workforce analytics and future AI-driven modules (NLP, RAG, Agentic AI).

## Overview

The new collections extend the base `Employee` model to capture rich, continuous HR data:
1. **Attendance**
2. **Performance Reviews**
3. **Employee Surveys**
4. **Employee Feedback**
5. **Manager Notes**
6. **Training History**
7. **Promotion History**

---

## 1. Attendance
Tracks daily employee presence, hours worked, overtime, and leave statuses.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `attendanceDate` (Date)
- `checkInTime` (Date, nullable)
- `checkOutTime` (Date, nullable)
- `totalHoursWorked` (Number)
- `overtimeHours` (Number)
- `attendanceStatus` (Enum: PRESENT, ABSENT, HALF_DAY, ON_LEAVE, HOLIDAY)
- `leaveType` (Enum: SICK, CASUAL, ANNUAL, MATERNITY, PATERNITY, UNPAID, NONE)
- `workMode` (Enum: OFFICE, REMOTE, HYBRID)
- `remarks` (String)

**Future AI Use:** Feature engineering for predicting attrition based on overtime or frequent absences.

---

## 2. Performance Reviews
Captures structured performance review data.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `reviewPeriod` (String, e.g., 'Q1 2024')
- `reviewerId` (ObjectId, ref: Employee)
- `performanceScore` (Number: 1-5)
- `goalAchievement` (Number)
- `strengths` (Array of Strings)
- `improvementAreas` (Array of Strings)
- `leadershipRating` (Number: 1-5)
- `teamworkRating` (Number: 1-5)
- `promotionRecommendation` (Boolean)
- `managerComments` (String)

**Future AI Use:** Correlating performance trends with flight risk.

---

## 3. Employee Surveys
Records employee engagement and satisfaction scores.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `surveyDate` (Date)
- `engagementScore` (Number: 1-5)
- `jobSatisfaction` (Number: 1-5)
- `workLifeBalance` (Number: 1-5)
- `stressLevel` (Number: 1-5)
- `careerGrowthScore` (Number: 1-5)
- `managerRelationshipScore` (Number: 1-5)
- `surveyComments` (String)

**Future AI Use:** NLP Sentiment Analysis on comments, correlating low satisfaction with attrition.

---

## 4. Employee Feedback
Unstructured, optionally anonymous feedback from employees.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `feedbackDate` (Date)
- `feedbackText` (String)
- `category` (Enum: MANAGEMENT, WORK_ENVIRONMENT, COMPENSATION, BENEFITS, OTHER)
- `anonymous` (Boolean)
- `visibility` (Enum: HR_ONLY, MANAGER, PUBLIC)
- `attachments` (Array of Strings)

**Future AI Use:** NLP + RAG to understand organizational pain points.

---

## 5. Manager Notes
Textual observations made by managers regarding their reports.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `managerId` (ObjectId, ref: Employee)
- `noteDate` (Date)
- `observation` (String)
- `recommendation` (String)
- `performanceConcern` (Boolean)
- `promotionDiscussion` (Boolean)
- `followUpRequired` (Boolean)

**Future AI Use:** NLP + SHAP Explanation Context to generate deeper manager insights.

---

## 6. Training History
Records of employee training and certification.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `courseName` (String)
- `provider` (String)
- `completionDate` (Date)
- `durationHours` (Number)
- `certificationEarned` (Boolean)
- `score` (Number)
- `remarks` (String)

---

## 7. Promotion History
Tracks historical role changes and salary adjustments.

**Fields:**
- `employeeId` (ObjectId, ref: Employee)
- `previousRole` (String)
- `newRole` (String)
- `promotionDate` (Date)
- `salaryIncreasePercentage` (Number)
- `reason` (String)
- `approvedBy` (ObjectId, ref: Employee)

**Future AI Use:** NLP + SHAP Explanation Context to generate deeper manager insights.

---

## REST APIs

All APIs are mounted under `/api/v1/hr/:collection` where `:collection` is one of `attendance`, `performance`, `surveys`, `feedback`, `notes`, `training`, `promotions`.

**Endpoints:**
- `GET /api/v1/hr/:collection` (List, supports pagination and filters like `employeeId`, `startDate`, `endDate`)
- `GET /api/v1/hr/:collection/:id` (Get single record)
- `POST /api/v1/hr/:collection` (Create record)
- `PUT /api/v1/hr/:collection/:id` (Update record)
- `DELETE /api/v1/hr/:collection/:id` (Delete record)

**Security (RBAC):**
- Admin / HR Manager: Full access.
- Employee: Can only view/create their *own* records (cannot view manager notes).

---

## Seeding
A seed script `server/src/scripts/seedHrData.js` exists to automatically populate these collections for existing IBM dataset employees.
