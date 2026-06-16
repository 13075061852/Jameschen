// Calendar grid generation and activity aggregation.
// Dependencies: utils/date.js (parseActivityDate), utils/workflow.js (getWorkflowEditTimeline)

import { parseActivityDate } from './date.js';
import { getWorkflowEditTimeline } from './workflow.js';

export function makeCalendarDays(monthKey, activitiesByDate) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const leadingDays = firstDay.getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = 0; index < leadingDays; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, '0')}`;
    cells.push({
      date,
      day,
      activities: activitiesByDate.get(date) ?? [],
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function buildCalendarActivities(customers) {
  const byDate = new Map();
  const addActivity = (date, activity) => {
    if (!date) return;
    const current = byDate.get(date) ?? [];
    const existing = current.find((item) => item.customerId === activity.customerId && item.workflowId === activity.workflowId);
    if (existing) {
      existing.types = Array.from(new Set([...existing.types, ...activity.types]));
      existing.lastEditedAt = activity.lastEditedAt || existing.lastEditedAt;
      existing.editTimeline = activity.editTimeline ?? existing.editTimeline ?? [];
      return;
    }
    current.push(activity);
    byDate.set(date, current);
  };

  customers.forEach((customer) => {
    const customerTitle = customer.displayTitle || customer.company || customer.contact || '未命名用户';
    (customer.timeline ?? []).forEach((workflow) => {
      const createdDate = parseActivityDate(workflow.createdAt) || parseActivityDate(workflow.date);
      const workflowDate = parseActivityDate(workflow.date) || createdDate;
      const editTimeline = getWorkflowEditTimeline(workflow);
      const title = workflow.title || workflow.content || '沟通记录';
      const baseActivity = {
        customerId: customer.id,
        customerTitle,
        workflowId: workflow.id,
        workflowTitle: title,
        status: workflow.status || '跟进中',
        date: workflowDate,
        createdAt: workflow.createdAt || '',
        lastEditedAt: workflow.lastEditedAt || '',
        editTimeline,
      };

      addActivity(workflowDate, {
        ...baseActivity,
        types: ['笔记'],
      });

      editTimeline.forEach((editEntry) => {
        const editedDate = parseActivityDate(editEntry.at);
        addActivity(editedDate, {
          ...baseActivity,
          types: ['修改'],
        });
      });
    });
  });

  byDate.forEach((activities) => {
    activities.sort((a, b) => {
      const bTime = new Date(b.lastEditedAt || b.createdAt || b.date).getTime() || 0;
      const aTime = new Date(a.lastEditedAt || a.createdAt || a.date).getTime() || 0;
      return bTime - aTime;
    });
  });

  return byDate;
}
