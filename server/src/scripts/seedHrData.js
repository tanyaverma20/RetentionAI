import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { Performance } from '../models/Performance.js';
import { Survey } from '../models/Survey.js';
import { EmployeeFeedback } from '../models/EmployeeFeedback.js';
import { ManagerNote } from '../models/ManagerNote.js';
import { TrainingHistory } from '../models/TrainingHistory.js';
import { PromotionHistory } from '../models/PromotionHistory.js';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/retentionai';

async function seedHrData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    const employees = await Employee.find({});
    if (employees.length === 0) {
      console.log('No employees found. Please seed employees first.');
      return;
    }

    const organizationId = employees[0].organizationId;
    console.log(`Found ${employees.length} employees. Seeding HR data...`);

    // Clear existing HR data
    await Promise.all([
      Attendance.deleteMany({ organizationId }),
      Performance.deleteMany({ organizationId }),
      Survey.deleteMany({ organizationId }),
      EmployeeFeedback.deleteMany({ organizationId }),
      ManagerNote.deleteMany({ organizationId }),
      TrainingHistory.deleteMany({ organizationId }),
      PromotionHistory.deleteMany({ organizationId }),
    ]);

    const attendances = [];
    const performances = [];
    const surveys = [];
    const feedbacks = [];
    const managerNotes = [];
    const trainingHistories = [];
    const promotionHistories = [];

    const today = new Date();

    for (const emp of employees) {
      // 1. Attendance (last 30 days)
      for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        // Skip weekends roughly
        if (date.getDay() !== 0 && date.getDay() !== 6) {
          const isAbsent = Math.random() < 0.05; // 5% absent rate
          attendances.push({
            organizationId,
            employeeId: emp._id,
            attendanceDate: date,
            checkInTime: isAbsent ? null : new Date(date.setHours(9, 0, 0, 0)),
            checkOutTime: isAbsent ? null : new Date(date.setHours(17, 30, 0, 0)),
            totalHoursWorked: isAbsent ? 0 : 8.5,
            attendanceStatus: isAbsent ? 'ABSENT' : 'PRESENT',
            leaveType: isAbsent ? 'SICK' : 'NONE',
            workMode: Math.random() > 0.3 ? 'OFFICE' : 'REMOTE',
          });
        }
      }

      // 2. Performance
      const reviewerId = emp.managerId || employees[0]._id; // fallback to first employee if no manager
      performances.push({
        organizationId,
        employeeId: emp._id,
        reviewPeriod: 'Annual 2024',
        reviewerId,
        performanceScore: Math.floor(Math.random() * 3) + 3, // 3 to 5
        goalAchievement: Math.floor(Math.random() * 10) + 5,
        strengths: ['Communication', 'Problem Solving'],
        improvementAreas: ['Time Management'],
        leadershipRating: Math.floor(Math.random() * 3) + 3,
        teamworkRating: Math.floor(Math.random() * 3) + 3,
        promotionRecommendation: Math.random() > 0.8,
        managerComments: 'Good overall performance this year.',
      });

      // 3. Survey
      surveys.push({
        organizationId,
        employeeId: emp._id,
        surveyDate: new Date(),
        engagementScore: Math.floor(Math.random() * 3) + 3,
        jobSatisfaction: Math.floor(Math.random() * 3) + 3,
        workLifeBalance: Math.floor(Math.random() * 3) + 3,
        stressLevel: Math.floor(Math.random() * 3) + 2, // 2 to 4
        careerGrowthScore: Math.floor(Math.random() * 3) + 3,
        managerRelationshipScore: Math.floor(Math.random() * 3) + 3,
        surveyComments: 'Generally happy with the work environment.',
      });

      // 4. Employee Feedback
      if (Math.random() > 0.5) { // 50% chance they gave feedback
        feedbacks.push({
          organizationId,
          employeeId: emp._id,
          feedbackDate: new Date(),
          feedbackText: 'Would love more training opportunities.',
          category: 'CAREER',
          anonymous: false,
          visibility: 'HR_ONLY',
        });
      }

      // 5. Manager Notes
      if (Math.random() > 0.3) {
        managerNotes.push({
          organizationId,
          employeeId: emp._id,
          managerId: reviewerId,
          noteDate: new Date(),
          observation: 'Employee showed great leadership in the recent project.',
          recommendation: 'Consider for lead role.',
          performanceConcern: false,
          promotionDiscussion: true,
          followUpRequired: false,
        });
      }

      // 6. Training History
      if (Math.random() > 0.4) {
        trainingHistories.push({
          organizationId,
          employeeId: emp._id,
          courseName: 'Advanced Leadership',
          provider: 'Coursera',
          completionDate: new Date(),
          durationHours: 20,
          certificationEarned: true,
          score: 95,
          remarks: 'Excellent participation.',
        });
      }

      // 7. Promotion History
      if (Math.random() > 0.7) {
        promotionHistories.push({
          organizationId,
          employeeId: emp._id,
          previousRole: 'Junior Engineer',
          newRole: 'Engineer',
          promotionDate: new Date(),
          salaryIncreasePercentage: 15,
          reason: 'Annual cycle promotion',
          approvedBy: reviewerId,
        });
      }
    }

    await Attendance.insertMany(attendances);
    await Performance.insertMany(performances);
    await Survey.insertMany(surveys);
    await EmployeeFeedback.insertMany(feedbacks);
    await ManagerNote.insertMany(managerNotes);
    await TrainingHistory.insertMany(trainingHistories);
    await PromotionHistory.insertMany(promotionHistories);

    console.log('HR Data seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
}

seedHrData();
