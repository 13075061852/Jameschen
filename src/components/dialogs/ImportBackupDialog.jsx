import React from 'react';
import { Upload } from 'lucide-react';

export default function ImportBackupDialog({ stats, onCancel, onOverwrite, onAppend }) {
  return (
    <div className="confirmOverlay" role="presentation" onMouseDown={onCancel}>
      <div className="confirmDialog importDialog" role="dialog" aria-modal="true" aria-labelledby="importTitle" onMouseDown={(event) => event.stopPropagation()}>
        <div className="confirmIcon importIcon">
          <Upload size={20} />
        </div>
        <div className="confirmContent">
          <h3 id="importTitle">导入数据</h3>
          <p>备份文件中共有 {stats.totalCount} 条客户数据，新增 {stats.newCount} 条，重复 {stats.duplicateCount} 条。</p>
        </div>
        <div className="importStats">
          <div>
            <span>新增</span>
            <strong>{stats.newCount}</strong>
          </div>
          <div>
            <span>重复</span>
            <strong>{stats.duplicateCount}</strong>
          </div>
        </div>
        <div className="confirmActions importActions">
          <button className="confirmCancel" onClick={onCancel}>取消</button>
          <button className="confirmCancel" onClick={onAppend} disabled={stats.newCount === 0}>追加新增数据</button>
          <button className="confirmDanger" onClick={onOverwrite}>覆盖当前数据</button>
        </div>
      </div>
    </div>
  );
}
