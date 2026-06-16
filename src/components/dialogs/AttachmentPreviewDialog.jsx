import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { escapeHtml } from '../../utils/html.js';

export default function AttachmentPreviewDialog({ preview, onClose }) {
  const downloadName = preview.name || '附件';
  const wordPreviewRef = useRef(null);
  const excelPreviewRef = useRef(null);
  const [excelSheets, setExcelSheets] = useState([]);
  const [excelActiveSheet, setExcelActiveSheet] = useState('');

  useEffect(() => {
    if (preview.status !== 'ready' || preview.kind !== 'word' || !preview.docxBuffer || !wordPreviewRef.current) return;

    let canceled = false;
    const container = wordPreviewRef.current;
    container.innerHTML = '';

    import('docx-preview')
      .then(({ renderAsync }) => renderAsync(preview.docxBuffer, container, null, {
        className: 'docxRenderedDocument',
        ignoreFonts: false,
        ignoreHeight: false,
        ignoreWidth: false,
        inWrapper: false,
        renderChanges: false,
        renderFooters: true,
        renderHeaders: true,
      }))
      .catch((error) => {
        if (!canceled) {
          container.innerHTML = `<div class="attachmentPreviewEmpty">${escapeHtml(error instanceof Error ? error.message : 'Word 预览失败')}</div>`;
        }
      });

    return () => {
      canceled = true;
      container.innerHTML = '';
    };
  }, [preview.docxBuffer, preview.kind, preview.status]);

  useEffect(() => {
    if (preview.status !== 'ready' || preview.kind !== 'excel' || !preview.excelBuffer) return;

    let canceled = false;

    import('xlsx')
      .then((XLSX) => {
        if (canceled) return;
        const workbook = XLSX.read(new Uint8Array(preview.excelBuffer), { type: 'array' });
        const sheets = workbook.SheetNames.map((name) => ({
          name,
          html: XLSX.utils.sheet_to_html(workbook.Sheets[name], { id: '', editable: false }),
        }));
        if (!canceled) {
          setExcelSheets(sheets);
          setExcelActiveSheet((current) => current || workbook.SheetNames[0] || '');
        }
      })
      .catch((error) => {
        if (!canceled) {
          setExcelSheets([]);
          setExcelActiveSheet('');
        }
      });

    return () => {
      canceled = true;
    };
  }, [preview.excelBuffer, preview.kind, preview.status]);

  const activeExcelHtml = excelSheets.find((sheet) => sheet.name === excelActiveSheet)?.html ?? '';

  return (
    <div className="confirmOverlay attachmentPreviewOverlay" role="presentation" onMouseDown={onClose}>
      <div className={`attachmentPreviewDialog ${preview.status === 'unsupported' ? 'compactPreviewDialog' : ''}`} role="dialog" aria-modal="true" aria-labelledby="attachmentPreviewTitle" onMouseDown={(event) => event.stopPropagation()}>
        <div className="attachmentPreviewHeader">
          <div>
            <h3 id="attachmentPreviewTitle">{preview.name}</h3>
          </div>
          <div className="attachmentPreviewActions">
            <a href={preview.url} download={downloadName}>下载</a>
            <button type="button" onClick={onClose}>关闭</button>
          </div>
        </div>
        <div className="attachmentPreviewBody">
          {preview.status === 'loading' && <div className="attachmentPreviewEmpty">正在加载预览</div>}
          {preview.status === 'error' && <div className="attachmentPreviewEmpty">{preview.message || '预览失败'}</div>}
          {preview.status === 'unsupported' && <div className="attachmentPreviewEmpty">当前格式暂不支持网页预览，请下载后查看。</div>}
          {preview.status === 'ready' && preview.kind === 'pdf' && (
            <iframe src={preview.previewUrl || preview.url} title={preview.name} />
          )}
          {preview.status === 'ready' && preview.kind === 'video' && (
            <div className="attachmentVideoPreview">
              <video src={preview.previewUrl || preview.url} controls autoPlay />
            </div>
          )}
          {preview.status === 'ready' && preview.kind === 'image' && (
            <div className="attachmentImagePreview">
              <img src={preview.url} alt={preview.name || '图片预览'} />
            </div>
          )}
          {preview.status === 'ready' && preview.kind === 'word' && (
            <div className="attachmentWordPreview" ref={wordPreviewRef} />
          )}
          {preview.status === 'ready' && preview.kind === 'excel' && (
            <div className="attachmentExcelPreview">
              {excelSheets.length > 1 && (
                <div className="excelSheetTabs">
                  {excelSheets.map((sheet) => (
                    <button
                      key={sheet.name}
                      type="button"
                      className={`excelSheetTab ${sheet.name === excelActiveSheet ? 'active' : ''}`}
                      onClick={() => setExcelActiveSheet(sheet.name)}
                    >
                      {sheet.name}
                    </button>
                  ))}
                </div>
              )}
              <div
                className="excelTableWrapper"
                ref={excelPreviewRef}
                dangerouslySetInnerHTML={{ __html: activeExcelHtml }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
