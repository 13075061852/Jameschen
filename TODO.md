# JamesChen CRM — 待完成任务清单

> **项目**：React + Vite 单页 CRM 应用，含自定义 contentEditable 富文本编辑器。
> **当前状态**：阶段1（模块拆分）已完成并提交。阶段2a（useCustomerStore hook）已创建文件但未接入 App.jsx。
> **目标 App.jsx**：从 5735 行瘦身到 ~300 行。

---

## 项目文件结构（当前）

```
src/
├── App.jsx                        # 5735行，主文件，待拆分
├── main.jsx                        # 11行，入口
├── config/constants.js             # ✅ 58行
├── utils/                          # ✅ 10个文件（纯函数，已完成）
├── db/                             # ✅ 3个文件（customerDb, assetStore, storage）
├── components/                     # ✅ 16个文件（子组件，已完成）
├── hooks/
│   └── useCustomerStore.js         # 🟡 438行，已创建未接入App.jsx
└── styles/                         # ✅ 12个CSS + index.css聚合
```

---

## 阶段2a：接入 useCustomerStore + 修复3个Bug

### 2a-1：将 useCustomerStore 接入 App.jsx

`src/hooks/useCustomerStore.js` 已写好，导出接口：

```js
export default function useCustomerStore({ getEditorContentFlush, viewStateCallbacks })
```

**需要做的事**：

1. 在 App.jsx 顶部 `import useCustomerStore from './hooks/useCustomerStore.js'`
2. 在 App 函数体内调用该 hook，传入：
   - `getEditorContentFlush`: 一个函数，调用 `saveCurrentEditorContent()` 并返回最新的 customers 数组（该函数依赖编辑器 DOM，留在 App.jsx 中）
   - `viewStateCallbacks`: 包含 `getSelectedId()`、`onHydrated(customers)` 等回调
3. 用 hook 返回的值替换 App.jsx 中对应的 ~20 个 useState/useRef/useEffect/函数
4. **保留在 App.jsx 中的桥接逻辑**（因为依赖编辑器 DOM 或多个 hook 交叉）：
   - `getCustomersWithCurrentEditorContent` — 需要读取 editorRef.current.innerHTML
   - `saveCurrentEditorContent` — 调用上面的函数然后 commitCustomers
   - `selectCustomer` — 需要先 save editor，再切换 selectedId
   - `performDeleteCustomer` 的调用方 — 需要先 flush editor 再删除
   - `addCustomer` — 需要创建后设置 selectedId
   - `addMessyNote` — 需要读取编辑器内容创建工作流
   - `confirmMentionDistribute` — 需要读取编辑器选区并写入多个客户

### 2a-2：修 ID 碰撞 Bug（高优先级）

**问题**：`c-${Date.now()}` 在快速连续调用时产生相同 ID（如双击新建按钮）。
**修复**：`useCustomerStore.js` 中的 `generateCustomerId()` 已实现（追加随机后缀 `-${Math.random().toString(36).slice(2,8)}`）。
**还需同步修复**：

- `addMessyNote` 中的 timeline item ID（行1854 `id: \`t-${Date.now()}\``）
- `confirmMentionDistribute` 中的 timeline item ID（行1260 `id: \`t-${Date.now()}-${Math.random()...}\`` — 这个已经有随机后缀，OK）
- `createMentionCustomer` 已通过 hook 的 `generateCustomerId()` 修复

### 2a-3：修 IndexedDB 写入竞态（高优先级）

**问题**：`saveCustomers`（db/storage.js）直接 JSON.stringify + IndexedDB write，快速连续调用可能丢失中间状态。
**修复方案**：在 `db/customerDb.js` 的 `saveCustomersToIndexedDb` 中加串行化队列：

```js
let writeQueue = Promise.resolve();
function saveCustomersToIndexedDb(customers) {
  writeQueue = writeQueue.then(() => _doWrite(customers)).catch(console.warn);
  return writeQueue;
}
```

### 2a-4：修附件跨客户共享 Bug（中优先级）

**问题**：导入备份时，多个客户可能引用同一个 dbasset ID 的附件。删除一个客户时 `cleanupUnusedAssets` 会扫描所有客户，如果另一个客户也引用该附件则不会删除——这部分逻辑其实是正确的。
**实际情况**：需重新验证 `cleanupUnusedAssets`（db/storage.js）的实现。如果它只检查被删除客户的附件则会误删。当前实现应该是检查全量客户列表，如果是这样则不需要修。

---

## 阶段2b：提取 useRichEditor Hook + 修复6个Bug

这是**最大最复杂**的任务。App.jsx 行 1832-4770 包含约 **80个编辑器函数**。

### 2b-1：创建 `src/hooks/useRichEditor.js`

**需要提取的 state/ref**（App.jsx 行 177-209）：

```js
editorRef, editorSelectionRef, pendingMentionHtmlRef,
imageInputRef, videoInputRef, attachmentInputRef,
imageDragStateRef, imageDragGhostRef, imageDropMarkerRef,
imageDragRafRef, imageDragLastEventRef,
editorSyncTimerRef, editorDirtyRef,
skipNextEditorSelectionSaveRef,
editorHistoryRef, editorObjectUrlsRef, formatPainterRef
```

以及编辑器 UI 状态：

```js
activeEditorFontSize/FontFamily/TextColor/BackgroundColor,
editorHydrationVersion,
editingWorkflowTitleId, workflowSortOrder,
archiveEditing, archiveDraft,
pendingDelete, attachmentPreview, exportDialogOpen,
mentionOpen/Query/SelectedIds/WorkflowTitle/SourceHtml/Targets,
contextMenu
```

**需要提取的函数分类**：

| 类别       | 函数（App.jsx 行号）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 数量  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| 历史管理     | `trimEditorHistoryStack(1930)`, `resetEditorHistory(1936)`, `recordEditorHistorySnapshot(1945)`, `placeEditorCursorAtEnd(1955)`, `restoreEditorHtmlFromHistory(1967)`, `commitPendingEditorHistory(1991)`, `undoEditorChange(2004)`, `redoEditorChange(2021)`                                                                                                                                                                                                                                                                                                                                                                                    | 8   |
| 内容同步     | `syncEditorContent(2038)`, `syncEditorContentAndFlushSave(2058)`, `flushEditorContentSync(2063)`, `getEditorHtmlForSave(1920)`, `updateEditorContent(1881)`, `updateMergedWorkflowContent(1903)`, `addMessyNote(1832)`                                                                                                                                                                                                                                                                                                                                                                                                                           | 7   |
| 选区管理     | `saveEditorSelection(2071)`, `clearEditorRangeSelectionState(2101)`, `clearTransientEditorSelectionClasses(2107)`, `restoreEditorSelection(2204)`, `getEditorSelectionHtml(2214)`, `getSavedEditorSelectionRange(2224)`, `updateEditorRangeSelectionState(2188)`                                                                                                                                                                                                                                                                                                                                                                                 | 7   |
| 格式化      | `applyEditorCommand(2585)`, `clearEditorFormatting(2600)`, `applyEditorTextColor(3372)`, `applyEditorBackgroundColor(3377)`, `toggleEditorItalic(3404)`, `applyEditorStyle(3240)`, `applyFormatPainterStyle(3302)`, `handleFormatPainter(3337)`, `unwrapElement(3393)`, `collectFormattingFromElement(3164)`, `applyFormatStyleToTextNodes(3137)`, `stripInlineFormatting(3104)`, `clearNestedEditorStyles(3080)`, `applyStyleToNestedEditorElements(3091)`, `selectionContainsEditorObject(3098)`, `getClosestStyledItalic(3382)`                                                                                                               | 16  |
| DOM规范化   | `normalizeEditorMediaFramePlacement(2123)`, `normalizeEditorTimestampProtection(2144)`, `prepareMergedWorkflowTimestampVisibility(2164)`, `prepareEditorImages(3000)`, `prepareEditorVideos(2935)`, `prepareEditorAttachments(3058)`, `prepareEditorStoredAssetSources(3065)`, `stripStoredAssetSrcBeforeDomInsert(2916)`, `clearAttachmentBackground(2900)`, `isEmptyEditorCursorLine(2117)`                                                                                                                                                                                                                                                    | 10  |
| 图片/视频/附件 | `prepareImageFrame(2874)`, `prepareAttachmentFrame(2889)`, `createAttachmentFrame(3549)`, `insertEditorImage(3829)`, `insertEditorVideo(3657)`, `insertEditorAttachment(3573)`, `handleEditorImageSelected(3904)`, `handleEditorVideoSelected(3669)`, `handleEditorAttachmentSelected(3704)`, `readImageAsResizedDataUrl(3607)`, `readFileAsDataUrl(3644)`, `isVideoFile(3653)`, `setEditorImageWidth(3814)`, `alignEditorImage(3819)`, `clearActiveEditorImage(2627)`, `clearActiveEditorAttachment(2633)`, `clearActiveEditorVideo(2639)`, `clearActiveEditorObjects(2645)`, `getActiveEditorImageFrame(3805)`, `getMaxEditorImageWidth(3810)` | 20  |
| 剪贴板      | `copyEditorSelection(2462)`, `getEditorSelectionClipboardPayload(2355)`, `getEditorClipboardPlainText(2319)`, `resolveClipboardImageSources(2282)`, `resolveClipboardAttachmentUrls(2306)`, `isInternalEditorClipboardHtml(2385)`, `normalizeInternalEditorClipboardHtml(2389)`, `insertEditorHtmlAtSelection(2430)`, `ensureEditorInsertionRange(2527)`, `getEditorMediaInsertionRange(2549)`, `addEditorLink(3439)`, `insertEditorTimestamp(3485)`                                                                                                                                                                                             | 12  |
| 拖拽       | `handleCustomImageDragMove(4142)`, `beginCustomImageDrag(4173)`, `stopCustomImageDrag(4114)`, `restoreImageFrameAfterCanceledDrag(4093)`, `finishImageDrop(4074)`, `placeImageDropMarker(4043)`, `ensureImageDropMarker(4030)`, `updateImageDragGhost(4020)`, `removeCustomImageDragListeners(4010)`, `removeImageDragGhost(4005)`, `removeImageDropMarker(4000)`, `getEditorDropRange(3983)`, `handleEditorDragOver(4544)`, `handleEditorDrop(4549)`                                                                                                                                                                                            | 14  |
| 事件处理     | `handleEditorPaste(4412)`, `handleEditorKeyDown(4627)`, `handleEditorClick(3938)`, `handleEditorDoubleClick(3969)`, `handleEditorContextMenu(1192)`, `handleEditorMouseMove(4208)`, `handleEditorMouseDown(4227)`, `autoLinkifyAtCursor(4284)`, `linkifyAllEditorContent(4336)`                                                                                                                                                                                                                                                                                                                                                                  | 9   |
| 附件预览/下载  | `downloadSelectedEditorAttachments(2263)`, `triggerBlobDownload(2251)`, `getSelectedEditorAttachments(2232)`, `openEditorAttachmentPreview(3738)`, `openEditorImagePreview(3777)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                | 5   |
| 工作流操作    | `deleteWorkflow(4771)`, `performDeleteWorkflow(4783)`, `performDeleteWorkflows(4804)`, `confirmPendingDelete(4824)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 4   |
| 导出       | `stripEditorFramesForExport(1469)`, `resolveHtmlAssetUrls(1560)`, `buildExportHtml(1613)`, `getExportWorkflows(1655)`, `handleExportPDF(1664)`, `handleExportWord(1759)`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 6   |

**hook 接口设计**：

```js
export default function useRichEditor({
  customers,           // from useCustomerStore
  customersRef,         // from useCustomerStore
  commitCustomers,      // from useCustomerStore
  commitCustomersFromUpdater, // from useCustomerStore
  flushCustomersSave,   // from useCustomerStore
  updateCustomer,       // from useCustomerStore
  selectedCustomer,     // derived in App
  selectedWorkflowId,   // state in App
  selectedWorkflow,     // derived in App
  selectedWorkflowIds,  // state in App
  isMergedWorkflowView, // derived in App
  workflowViewMode,     // state in App
  mainView,             // state in App
  editorKey,            // derived in App
  editorContent,        // derived in App
  selectedWorkflowContent, // derived in App
  renderWorkflowEditorSection, // derived in App
  setSelectedWorkflowId,      // state setter
  setSelectedWorkflowIds,     // state setter
  setEditingWorkflowTitleId,  // state setter
  setArchiveEditing,         // state setter
  setArchiveDraft,           // state setter
  setSelectedId,             // state setter
  setPendingDelete,          // state setter
  setAttachmentPreview,      // state setter
  setExportDialogOpen,       // state setter
  setMentionOpen,            // state setter
  setContextMenu,             // state setter
  setEditorHydrationVersion, // state setter
  // ... other setters
})
```

**返回值**：所有编辑器操作函数 + 编辑器 state + ref。

### 2b-2：修 Debounce Timer 未接线 Bug（高优先级）

**问题**：`editorSyncTimerRef` 在多处 `clearTimeout` 但未在 `input` 事件中启动 debounce 定时器。
**位置**：App.jsx 行 407-413 的 `handleNativeEditorInput` 直接调用 `saveCurrentEditorContent()` 而不是 debounce。
**修复**：

```js
function handleNativeEditorInput() {
  clearTimeout(editorSyncTimerRef.current);
  editorDirtyRef.current = true;
  editorSyncTimerRef.current = setTimeout(() => {
    editorSyncTimerRef.current = null;
    syncEditorContent();
  }, 400); // 或使用一个合理的 debounce 值
}
```

### 2b-3：修 Hydrate Effect 依赖过宽（高优先级）

**问题**：行 373 的 effect 依赖 `[mainView, editorKey, isMergedWorkflowView, singleWorkflowMetaKey, editorHydrationVersion]`，其中 `singleWorkflowMetaKey` 包含 `title` 和 `status` 等用户编辑的字段，修改标题会触发整个编辑器重渲染。
**修复**：移除 `singleWorkflowMetaKey` 依赖，改用 `selectedWorkflowId` 作为判断 key（单个工作流视图只需要知道是哪个工作流，内容由 hydrate version 控制）。

### 2b-4：修 ObjectURL 内存泄漏（中优先级）

**问题**：切换客户时 `editorObjectUrlsRef` 中积累的 blob URL 未 revoke，只在组件卸载时统一清理。
**修复**：在切换客户时（`selectCustomer` 或 selectedId 变化的 effect 中）清理：

```js
useEffect(() => {
  editorObjectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  editorObjectUrlsRef.current.clear();
}, [selectedId]);
```

### 2b-5：修 Undo/Redo 原生+自定义栈冲突（中优先级）

**问题**：自定义 history stack 和浏览器原生 undo/redo 同时存在。当自定义栈为空时 fallback 到 `document.execCommand('undo')`，但浏览器的 undo history 包含了 contentEditable 的操作记录，两者会互相干扰。
**修复方案**：在编辑器操作中使用 `document.execCommand('styleWithCSS')` 等时禁止浏览器记录 undo（或在每次自定义操作后清空浏览器 undo history），或者完全放弃原生 undo 只用自定义栈。

### 2b-6：修粘贴 Fallback 缺少 preventDefault（中优先级）

**问题**：`handleEditorPaste`（行4412）在某些分支路径上未调用 `event.preventDefault()`，导致浏览器默认粘贴行为与自定义处理叠加。
**修复**：确保 `handleEditorPaste` 入口处立即 `event.preventDefault()`，然后所有分支走自定义逻辑。

### 2b-7：修 PNG→JPEG 硬编码（低优先级）

**问题**：`imageDataUrlToPngBlob`（utils/asset.js）函数名暗示输出 PNG，但导出 PDF 时（行1738）`sliceCanvas.toDataURL('image/jpeg', 0.92)` 硬编码 JPEG，会丢失透明通道。
**修复**：对含透明像素的图片使用 `image/png` 格式。

---

## 阶段2c：提取 useLayoutPanel Hook

提取布局相关逻辑：

- **State**：leftCollapsed, rightCollapsed, leftPanelWidth, rightPanelWidth, activeResizer
- **函数**：toggleLeftCollapsed, toggleRightCollapsed, toggleEditorExpanded, startResize
- **Effect**：resize 拖拽 pointermove/pointerup 监听（行577-622）、saveLayout 持久化（行534-536）
- **Ref**：boardRef

预估 ~120 行。

---

## 阶段2d：提取 usePersistSync Hook

提取视图状态持久化逻辑：

- **State**：selectedId, selectedWorkflowId, selectedWorkflowIds, workflowViewMode, mainView, calendarMonth, selectedCalendarDate
- **Ref**：workflowSelectionByCustomerRef, mergedWorkflowSelectionByCustomerRef
- **函数**：selectCustomer, selectSingleWorkflow, focusWorkflow, toggleMergedWorkflow, changeWorkflowViewMode, openCalendarActivity, toggleMainView, rememberSelectedWorkflowForCustomer, rememberMergedWorkflowSelectionForCustomer, getRememberedWorkflowId, getRememberedMergedWorkflowIds
- **Effect**：saveViewState 持久化（行538-540）、selectedId 有效性校验（行542-574）、workflow selection 记忆（行350-356）

预估 ~200 行。

---

## 阶段3a：提取内联 JSX 为独立组件

App.jsx 行 4841-5735（895行 JSX return）需拆分为：

| 组件                    | 内容                                      | 预估行数 |
| --------------------- | --------------------------------------- | ---- |
| `TopBar`              | 顶栏：品牌logo、日历切换、导出/备份/导入按钮               | ~60  |
| `CustomerListPanel`   | 左侧面板：搜索、过滤、客户列表、拖拽排序、批量操作               | ~150 |
| `EditorPanel`         | 中间编辑器面板：工具栏、contentEditable编辑器、@提及、右键菜单 | ~300 |
| `WorkflowPanel`       | 右侧面板：工作流列表、合并视图、新建工作流、归档                | ~150 |
| `MentionDialog`       | @提及分发弹窗                                 | ~80  |
| `ExportDialog`        | 导出选项弹窗（PDF/Word）                        | ~40  |
| `ConfirmDeleteDialog` | 删除确认弹窗                                  | ~30  |

---

## 阶段3b：App.jsx 瘦身到 ~300 行

App.jsx 最终应只包含：

1. 导入语句（~30行）
2. Hook 调用组合（~40行）
3. 桥接函数（编辑器↔客户数据交互，~50行）
4. 顶层 JSX 布局（~100行）
5. 导出（~1行）

---

## 阶段3c：修复剩余 Bug

| Bug              | 描述                                                                         | 位置                      |
| ---------------- | -------------------------------------------------------------------------- | ----------------------- |
| 时区偏移             | `parseActivityDate`（utils/date.js）中 `new Date(dateStr)` 受本地时区影响            | utils/date.js           |
| 日历死循环            | `makeCalendarDays`（utils/calendar.js）或 `buildCalendarActivities` 中可能的无限重渲染 | utils/calendar.js       |
| 复制图片到外部          | 编辑器内复制含 dbasset URL 的图片粘贴到外部应用时 URL 无法解析                                   | handleEditorPaste       |
| 下载 revoke timing | `URL.revokeObjectURL` 在下载后可能过早调用（triggerBlobDownload 等）                    | utils/asset.js, App.jsx |
| 时间戳保护绕过          | `data-undeletable` timestamp 在粘贴覆盖时可能被删除                                   | handleEditorPaste       |

---

## 阶段4：最终验证

全功能回归测试清单：

- [ ] 客户 CRUD + 搜索过滤 + 排序
- [ ] 拖拽排序客户
- [ ] 编辑器输入 + 格式化（加粗/斜体/下划线/对齐/颜色/字号）
- [ ] 撤销/重做
- [ ] 图片/视频/附件插入 + 预览 + 下载
- [ ] 粘贴图片/文本/HTML（含从外部应用粘贴）
- [ ] 工作流新建/编辑/删除
- [ ] 合并视图（多工作流同时显示）
- [ ] @提及分发（选中内容发送到其他客户）
- [ ] 归档编辑
- [ ] 备份导出/导入
- [ ] PDF/Word 导出
- [ ] 日历视图
- [ ] 面板折叠/调整大小
- [ ] beforeunload 保存（关闭页面前自动保存）
- [ ] IndexedDB 水合 + localStorage 回退
- [ ] 批量选择/删除
- [ ] 右键菜单
- [ ] 格式刷

---

## 重要约定

1. **保持 JavaScript**，不用 TypeScript
2. **不引入外部状态管理库**（no Redux/Zustand/Jotai），用自定义 hooks
3. CSS 已拆分完成，不需要改动
4. utils/ 和 db/ 中的纯函数已提取完成，不需要改动
5. components/ 中已有16个子组件，阶段3a是提取更大的面板级组件
6. 每个阶段完成后需 `npm run build` 验证通过
7. git 提交信息格式：`refactor: 阶段X — 描述`
