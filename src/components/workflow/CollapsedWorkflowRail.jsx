import React from 'react';

export default function CollapsedWorkflowRail({ workflows, selectedWorkflowId, onSelect, onMergeView, isMerged }) {
  return (
    <div className="collapsedRail" title="最近工作流" aria-label="最近工作流">
      {workflows.length > 1 && onMergeView && (
        <button
          className={`collapsedMergeButton ${isMerged ? 'active' : ''}`}
          onClick={onMergeView}
          title={isMerged ? '切换为单个查看' : '合并查看所有工作流'}
          aria-label={isMerged ? '切换为单个查看' : '合并查看所有工作流'}
        >
          合并
        </button>
      )}
      <div className="collapsedWorkflowList">
        {workflows.map((workflow) => (
          <button
            key={workflow.id}
            className={`collapsedWorkflowButton ${workflow.id === selectedWorkflowId ? 'active' : ''}`}
            onClick={() => onSelect(workflow.id)}
            title={`${workflow.date} · ${workflow.title ?? workflow.content ?? '沟通记录'} · ${workflow.status}`}
            aria-label={`${workflow.date} ${workflow.title ?? workflow.content ?? '沟通记录'} ${workflow.status}`}
          >
            <span className={`statusDot status${workflow.status}`} />
            <small>{workflow.date?.slice(5).replace('-', '/')}</small>
          </button>
        ))}
        {workflows.length === 0 && (
          <div className="collapsedWorkflowEmpty" title="暂无工作流">空</div>
        )}
      </div>
      <strong>{workflows.length}</strong>
    </div>
  );
}
