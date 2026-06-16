import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { getMonthLabel } from '../../utils/date.js';
import { formatActivityTime } from '../../utils/date.js';

export default function CalendarView({
  month,
  days,
  selectedDate,
  selectedActivities,
  today,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
  onOpenActivity,
}) {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const selectedDateLabel = selectedDate ? `${selectedDate.slice(5, 7)}月${selectedDate.slice(8, 10)}日` : '';
  const canGoNextMonth = month < today.slice(0, 7);
  const [collapsedCustomerGroups, setCollapsedCustomerGroups] = useState(new Set());
  const [agendaWidth, setAgendaWidth] = useState(300);
  const [activeCalendarResize, setActiveCalendarResize] = useState(false);
  const calendarLayoutRef = useRef(null);
  const groupedActivities = useMemo(() => {
    const groupMap = new Map();
    selectedActivities.forEach((activity) => {
      const group = groupMap.get(activity.customerId) ?? {
        customerId: activity.customerId,
        customerTitle: activity.customerTitle,
        activities: [],
      };
      group.activities.push(activity);
      groupMap.set(activity.customerId, group);
    });
    return Array.from(groupMap.values());
  }, [selectedActivities]);

  function toggleCustomerGroup(customerId) {
    const groupKey = `${selectedDate}:${customerId}`;
    setCollapsedCustomerGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!activeCalendarResize) return undefined;

    const handlePointerMove = (event) => {
      const layoutRect = calendarLayoutRef.current?.getBoundingClientRect();
      if (!layoutRect) return;
      const minAgendaWidth = 260;
      const minCalendarWidth = 640;
      const maxAgendaWidth = Math.max(minAgendaWidth, layoutRect.width - minCalendarWidth);
      const nextWidth = Math.min(
        Math.max(layoutRect.right - event.clientX, minAgendaWidth),
        maxAgendaWidth,
      );
      setAgendaWidth(Math.round(nextWidth));
    };

    const stopResizing = () => {
      setActiveCalendarResize(false);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
  }, [activeCalendarResize]);

  return (
    <div className="calendarView">
      <div className="calendarToolbar">
        <button type="button" className="calendarNavButton" onClick={onPrevMonth} title="上个月">
          <ChevronLeft size={17} />
        </button>
        <div className="calendarMonthTitle">
          <strong>{getMonthLabel(month)}</strong>
          <span>{selectedDateLabel}</span>
        </div>
        <button type="button" className="calendarNavButton" onClick={onNextMonth} title="下个月" disabled={!canGoNextMonth}>
          <ChevronRight size={17} />
        </button>
        <button type="button" className="calendarTodayButton" onClick={onToday}>
          今天
        </button>
      </div>

      <div
        ref={calendarLayoutRef}
        className={`calendarLayout ${activeCalendarResize ? 'isCalendarResizing' : ''}`}
        style={{ '--calendar-agenda-width': `${agendaWidth}px` }}
      >
        <div className="calendarGridPanel">
          <div className="calendarWeekHeader">
            {weekDays.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendarGrid">
            {days.map((day, index) => {
              if (!day) return <div key={`blank-${index}`} className="calendarDay emptyDay" />;
              if (day.date > today) return <div key={day.date} className="calendarDay emptyDay futureDay" />;
              const isSelected = day.date === selectedDate;
              const isToday = day.date === today;
              const visibleActivities = day.activities.slice(0, 3);
              const hiddenActivityCount = Math.max(day.activities.length - visibleActivities.length, 0);
              const activityTitle = day.activities
                .map((activity) => activity.workflowTitle)
                .join('、');

              return (
                <button
                  key={day.date}
                  type="button"
                  className={`calendarDay ${isSelected ? 'selectedDay' : ''} ${isToday ? 'todayDay' : ''} ${day.activities.length > 0 ? 'hasActivity' : ''}`}
                  onClick={() => onSelectDate(day.date)}
                  title={`${day.date} · ${day.activities.length} 条记录${activityTitle ? ` · ${activityTitle}` : ''}`}
                >
                  <span className="calendarDayHeader">
                    <span className="calendarDayNumber">{day.day}</span>
                    {day.activities.length > 0 && (
                      <span className="calendarDayCount">{day.activities.length}</span>
                    )}
                  </span>
                  {visibleActivities.length > 0 && (
                    <span className="calendarDayWorkflows">
                      {visibleActivities.map((activity) => (
                        <span key={activity.workflowId} title={activity.workflowTitle}>
                          {activity.workflowTitle}
                        </span>
                      ))}
                      {hiddenActivityCount > 0 && (
                        <span className="calendarDayMore">+{hiddenActivityCount}</span>
                      )}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="calendarAgendaResizer"
          onPointerDown={(event) => {
            event.preventDefault();
            setActiveCalendarResize(true);
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label="调整日历记录栏宽度"
        />

        <div className="calendarAgenda">
          <div className="calendarAgendaHeader">
            <div>
              <h3>{selectedDateLabel || '选择日期'}</h3>
              <span>{selectedActivities.length} 条记录</span>
            </div>
          </div>
          <div className="calendarAgendaList">
            {selectedActivities.length === 0 ? (
              <div className="calendarEmptyDay">当天没有笔记或修改记录</div>
            ) : groupedActivities.map((group) => {
              const groupKey = `${selectedDate}:${group.customerId}`;
              const collapsed = collapsedCustomerGroups.has(groupKey);

              return (
                <div key={group.customerId} className={`calendarCustomerGroup ${collapsed ? 'collapsed' : ''}`}>
                  <button
                    type="button"
                    className="calendarCustomerGroupHeader"
                    onClick={() => toggleCustomerGroup(group.customerId)}
                  >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <strong>{group.customerTitle}</strong>
                    <span>{group.activities.length} 条笔记</span>
                  </button>
                  {!collapsed && (
                    <div className="calendarCustomerNotes">
                      {group.activities.map((activity) => (
                        <button
                          key={`${activity.customerId}-${activity.workflowId}-${activity.types.join('-')}`}
                          type="button"
                          className="calendarAgendaItem"
                          onClick={() => onOpenActivity(activity)}
                        >
                          <div className="calendarAgendaTopline">
                            <strong>{activity.workflowTitle}</strong>
                            <span className={`statusTag status${activity.status}`}>{activity.status}</span>
                          </div>
                          <div className="calendarAgendaMeta">
                            <span>{activity.date}</span>
                          </div>
                          {activity.editTimeline?.length > 0 && (
                            <div className="calendarEditTimeline">
                              {activity.editTimeline.map((entry) => (
                                <span key={entry.at}>修改记录 {formatActivityTime(entry.at)}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
