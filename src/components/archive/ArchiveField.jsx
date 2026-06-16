import React from 'react';
import { CUSTOMER_GRADES, gradeMap } from '../../config/constants.js';
import { normalizeWebsiteUrl, normalizeEmailHref } from '../../utils/url.js';

export default function ArchiveField({ label, defaultLabel, fieldKey, archiveCustomer, editing, editingLabel, updateArchiveDraft, updateArchiveFieldLabel }) {
  const isGrade = fieldKey === 'grade';
  const fieldValue = archiveCustomer[fieldKey] ?? '';
  const linkHref = fieldKey === 'website'
    ? normalizeWebsiteUrl(fieldValue)
    : fieldKey === 'email'
      ? normalizeEmailHref(fieldValue)
      : '';

  return (
    <div className={`archiveField ${isGrade ? 'selectInput' : ''} ${editing ? 'editingField' : ''}`}>
      <span className="archiveFieldLabel">
        {editing ? (
          <span
            className="archiveFieldLabelText"
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={`修改字段名：${defaultLabel}`}
            onBlur={(event) => updateArchiveFieldLabel(fieldKey, event.currentTarget.textContent?.trim() || defaultLabel)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          >
            {editingLabel}
          </span>
        ) : (
          label
        )}
      </span>
      {isGrade ? (
        <select
          value={archiveCustomer.grade}
          disabled={!editing}
          onChange={(event) => updateArchiveDraft('grade', event.target.value)}
        >
          {CUSTOMER_GRADES.map((grade) => (
            <option key={grade} value={grade}>{grade} - {gradeMap[grade]}</option>
          ))}
        </select>
      ) : linkHref && !editing ? (
        <a
          className="archiveFieldValueLink"
          href={linkHref}
          target={fieldKey === 'website' ? '_blank' : undefined}
          rel={fieldKey === 'website' ? 'noopener noreferrer' : undefined}
          title={fieldValue}
        >
          {fieldValue}
        </a>
      ) : (
        <input
          value={fieldValue}
          disabled={!editing}
          onChange={(event) => updateArchiveDraft(fieldKey, event.target.value)}
          placeholder="未填写"
        />
      )}
    </div>
  );
}
