import { readImportBackup } from './save-transfer.js';
import { icon } from './icons.js';
import { splitSaveCode, collectSaveParts } from './save-parts.js';
import { paintSaveImage } from './save-image-card.js';
import { shareImagePreview } from './share-image.js';
import { MAX_IMAGE_FILE } from './save-image-file.js';
import './save-ui.css';

export function createSaveUI(api) {
  let controller, codeExpanded = false;
  api.dialog.addEventListener('close', () => controller?.abort());
  function work(data, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(Error('已取消。')); return; }
      const worker = new Worker(new URL('./save-worker.js', import.meta.url), { type: 'module' });
      const finish = (error, result) => {
        clearTimeout(timeout); signal.removeEventListener('abort', abort); worker.terminate();
        error ? reject(error) : resolve(result);
      };
      const abort = () => finish(Error('已取消。'));
      const timeout = setTimeout(() => finish(Error('处理时间过长，请换用备用存档码或 JSON 文件。')), data.action.startsWith('image-') ? 90000 : 15000);
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({ data }) => finish(data.error ? Error(data.error) : null, data.result);
      worker.onerror = () => finish(Error('存档工具未能加载，请刷新游戏后重试。'));
      worker.postMessage(data);
    });
  }
  function open(mode = 'save') {
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal;
    let snapshot, candidate, code = '', generation = 0, parts = [], part = 0, split = false, collected = null;
    let imageBlob = null, imageBusy = false, imageToken = 0, importToken = 0, imageController = null;
    api.modal(`<section class="save-panel"><header class="save-heading"><span class="save-heading-icon">${icon('save', 30)}</span><div><h2>存档与读档</h2><p>把进度带到另一台设备</p></div></header>
      <div class="save-tabs" role="tablist" aria-label="存档操作"><button id="save-tab" role="tab" aria-controls="save-view">保存进度</button><button id="load-tab" role="tab" aria-controls="load-view">读取进度</button></div>
      <div id="save-view" role="tabpanel" aria-labelledby="save-tab">
        <div class="save-section-heading"><h3>当前进度</h3><span>本机生成 · 无需上传</span></div>
        <div class="save-preview-layout"><dl class="save-summary" id="save-summary"></dl><figure class="save-picture"><div id="save-picture" aria-busy="true"><span class="save-image-placeholder">正在制作存档图…</span></div><figcaption id="save-image-hint">完整进度保存在图片里</figcaption></figure></div>
        <div class="save-buttons"><button class="primary" id="save-image-download" disabled>${icon('download',17)}保存存档图</button><button id="refresh-save" aria-label="更新存档" title="更新为当前进度">${icon('undo', 17)}</button></div>
        <p class="save-footnote">手机可长按图片保存到相册。继续游玩后，点更新按钮生成最新存档图。</p>
        <details class="save-code-details" id="save-code-details" ${codeExpanded ? 'open' : ''}><summary><span>备用：存档码</span><span id="save-code-size"></span>${icon('chevron',14)}</summary>
          <textarea id="save-code" readonly spellcheck="false" aria-label="存档码" placeholder="正在生成…"></textarea>
          <div class="save-buttons"><button id="copy-save" disabled>${icon('copy', 17)}复制存档码</button></div>
        <div class="save-part-tools" id="save-part-tools" hidden><button id="split-save">聊天框放不下？分段复制</button><span id="part-navigation" hidden><button id="previous-part" aria-label="上一段">←</button><span id="part-position"></span><button id="next-part" aria-label="下一段">→</button></span></div>
        </details>
      </div>
      <div id="load-view" role="tabpanel" aria-labelledby="load-tab" hidden>
        <p class="save-intro">选择相册里的存档图，核对进度后再读取。</p>
        <div class="save-buttons"><button class="primary" id="choose-save-image">${icon('album',18)}选择存档图片</button></div><input id="import-save-image" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" hidden>
        <p id="load-image-name" class="save-footnote" hidden></p>
        <details class="save-code-details" id="load-code-backup"><summary><span>使用备用存档码</span>${icon('chevron',14)}</summary>
        <label class="save-field" for="load-code">存档码</label><textarea id="load-code" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="粘贴完整存档码，或逐段添加" maxlength="12582912"></textarea>
        <div class="save-buttons"><button class="primary" id="inspect-save" disabled>查看这份存档</button></div>
        <div class="save-part-tools" id="load-parts" hidden><span id="load-parts-count"></span><button id="clear-parts">清空片段</button></div>
        </details>
        <div id="load-preview" hidden><div class="save-section-heading"><h3>这份存档</h3><span>${icon('check',14)}已检查</span></div><dl class="save-summary" id="load-summary"></dl>
          <p class="save-intro">确认后替换当前进度。读档前的进度会自动备份在本机。</p>
          <div class="save-buttons"><button id="cancel-import">取消</button><button class="primary" id="confirm-import">使用这份存档</button></div>
        </div>
      </div>
      <p class="save-feedback" id="save-feedback" role="status" aria-live="polite"></p>
      <div class="save-files"><button id="export-save">${icon('download', 16)}备用导出 <small>JSON</small></button><button id="choose-save-file">${icon('save',16)}导入文件 <small>JSON</small></button><input id="import-save" type="file" accept=".json,application/json" hidden><button id="restore-save-backup" hidden>${icon('undo', 15)}恢复读档前的进度</button></div>
    </section>`);
    const root = api.dialog.querySelector('.save-panel'), $ = s => root.querySelector(s);
    const alive = () => root.isConnected && api.dialog.open && !signal.aborted;
    function message(text, error = false) { if (alive()) { $('#save-feedback').textContent = text; $('#save-feedback').classList.toggle('is-error', error); } }
    function summary(target, value) {
      const worlds = { overworld: '主世界', nether: '下界', end: '末地' };
      const minutes = Math.floor((value.play || 0) / 60);
      const time = value.savedAt ? new Date(value.savedAt).toLocaleString('zh-CN', { hour12: false }) : '旧存档未记录';
      const rows = [['绿宝石', api.format(value.money)], ['游玩时间', minutes < 60 ? `${minutes} 分钟` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`],
        ['所在世界', worlds[value.realm] || '主世界'], ['村民', `${value.counts?.V2 || 0} 位`], ['保存时间', time]];
      target.replaceChildren();
      for (const [label, text] of rows) {
        const group = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        group.className = label === '保存时间' ? 'save-stat save-stat-date' : 'save-stat';
        dt.textContent = label; dd.textContent = text; group.append(dt, dd); target.append(group);
      }
    }
    $('#save-code-details').ontoggle = () => { codeExpanded = $('#save-code-details').open; };
    function tab(value) {
      mode = value;
      if (value === 'load' && imageBusy) { imageToken++; imageBusy = false; imageController?.abort(); }
      for (const name of ['save', 'load']) { const selected = mode === name; $(`#${name}-view`).hidden = !selected; $(`#${name}-tab`).setAttribute('aria-selected', String(selected)); $(`#${name}-tab`).tabIndex = selected ? 0 : -1; }
      message('');
      if (value === 'save' && code && !imageBlob && !imageBusy) makeImage();
    }
    for (const name of ['save', 'load']) {
      $(`#${name}-tab`).onclick = () => tab(name);
      $(`#${name}-tab`).onkeydown = e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); tab(e.key === 'Home' ? 'save' : e.key === 'End' ? 'load' : mode === 'save' ? 'load' : 'save'); $(`#${mode}-tab`).focus(); } };
    }
    async function generate() {
      const token = ++generation;
      imageController?.abort();
      snapshot = api.snapshot(); summary($('#save-summary'), snapshot);
      imageToken++; imageBlob = null; imageBusy = false; $('#save-image-download').disabled = true;
      $('#save-picture').replaceChildren(Object.assign(document.createElement('span'), { className: 'save-image-placeholder', textContent: '正在制作存档图…' }));
      $('#save-picture').setAttribute('aria-busy', 'true'); $('#save-image-hint').textContent = '完整进度保存在图片里';
      $('#copy-save').disabled = true; $('#refresh-save').disabled = true;
      $('#save-code').value = ''; $('#save-code-size').textContent = ''; code = ''; split = false; part = 0;
      $('#save-part-tools').hidden = true; message('');
      try {
        const result = await work({ action: 'encode', raw: snapshot, release: api.release }, signal);
        if (!alive() || token !== generation) return;
        code = result; parts = splitSaveCode(code); $('#copy-save').disabled = false;
        $('#save-part-tools').hidden = result.length <= 500; showCode();
        if (mode === 'save') makeImage();
      } catch (error) {
        if (!alive() || token !== generation) return;
        $('#save-picture').replaceChildren(Object.assign(document.createElement('span'), { className: 'save-image-placeholder', textContent: '暂未生成图片' }));
        $('#save-picture').setAttribute('aria-busy', 'false');
        $('#save-image-hint').textContent = '可重试，或使用下方 JSON 备份';
        message(error.message, true);
      }
      finally { if (alive() && token === generation) $('#refresh-save').disabled = false; }
    }
    async function makeImage() {
      if (!code || imageBusy) return;
      const token = ++imageToken, sourceCode = code, source = snapshot;
      const task = new AbortController(), abortImage = () => task.abort(); imageController = task;
      signal.addEventListener('abort', abortImage, { once: true });
      imageBusy = true; imageBlob = null; $('#save-image-download').disabled = true;
      $('#save-picture').setAttribute('aria-busy', 'true');
      const current = () => alive() && token === imageToken && code === sourceCode;
      try {
        const encoded = await work({ action: 'image-encode', code: sourceCode, theme: source.webAppearance?.equipped?.theme || '' }, task.signal);
        if (!current()) return;
        const blob = await paintSaveImage(encoded, source, api.release, api.format);
        if (!current()) return;
        // Decode the final PNG, including its frame, before offering it to save.
        const checked = await work({ action: 'image-decode', file: blob }, task.signal);
        if (!current()) return;
        if (checked.code !== sourceCode) throw Error('存档图校验失败，请使用备用存档码。');
        const image = await shareImagePreview(blob, 'MC Clicker 完整存档图');
        if (!current()) return;
        image.className = 'save-card-image'; image.setAttribute('aria-describedby', 'save-image-hint');
        $('#save-picture').replaceChildren(image); imageBlob = blob;api.backedUp?.();
        $('#save-image-hint').textContent = '已校验 · 长按图片保存';
        $('#save-image-download').innerHTML = `${icon('download',17)}保存存档图`;
      } catch (error) {
        if (!current()) return;
        $('#save-picture').replaceChildren(Object.assign(document.createElement('span'), { className: 'save-image-placeholder', textContent: '暂未生成图片' }));
        $('#save-image-hint').textContent = '可用下方存档码或 JSON 备份';
        $('#save-image-download').textContent = '重新生成存档图';
        if (mode === 'save') message(error.message, true);
      } finally {
        signal.removeEventListener('abort', abortImage); if (imageController === task) imageController = null;
        if (current()) { imageBusy = false; $('#save-image-download').disabled = false; $('#save-picture').setAttribute('aria-busy', 'false'); }
      }
    }
    $('#save-image-download').onclick = () => {
      if (!imageBlob) { makeImage(); return; }
      try {
        api.download(imageBlob, `MC-Clicker-save-${new Date(snapshot.savedAt).toISOString().slice(0,10)}.png`);
        message('已尝试下载。手机也可以长按上方图片保存到相册。');
      } catch { message('浏览器未允许下载，请长按上方图片保存。', true); }
    };
    function showCode() {
      const value = split ? parts[part] : code;
      $('#save-code').value = value;
      $('#save-code-size').textContent = `${value.length.toLocaleString('en-US')} 字符${split ? ' / 段' : ''}`;
      $('#split-save').textContent = split ? '返回完整存档码' : '聊天框放不下？分段复制';
      $('#part-navigation').hidden = !split;
      $('#part-position').textContent = `${part + 1} / ${parts.length} 段`;
      $('#previous-part').disabled = part === 0; $('#next-part').disabled = part === parts.length - 1;
      $('#copy-save').innerHTML = `${icon('copy',17)}${split ? `复制第 ${part + 1} 段` : '复制存档码'}`;
    }
    $('#split-save').onclick = () => { split = !split; part = 0; if (split) $('#save-code-details').open = true; showCode(); message(split ? `共 ${parts.length} 段，每段不超过 500 字符。读取时需要全部片段。` : ''); };
    $('#previous-part').onclick = () => { if (part > 0) { part--; showCode(); message(''); } };
    $('#next-part').onclick = () => { if (part < parts.length - 1) { part++; showCode(); message(''); } };
    $('#refresh-save').onclick = generate;
    $('#copy-save').onclick = async () => {
      const value = $('#save-code').value, index = part, segmented = split;
      try { await navigator.clipboard.writeText(value); message(segmented ? `已复制第 ${index + 1} / ${parts.length} 段。请保存全部片段。` : '已复制。请粘贴到备忘录或其他设备保存。'); }
      catch {
        if (!alive()) return;
        $('#save-code-details').open = true;
        const field = $('#save-code'); field.focus(); field.select(); field.setSelectionRange(0, field.value.length);
        message('浏览器未允许自动复制，已选中整段存档码。请长按或按 Ctrl / ⌘ + C 复制。');
      }
    };
    function loadInput() { candidate = null; $('#load-preview').hidden = true; $('#inspect-save').disabled = !$('#load-code').value.trim(); $('#inspect-save').textContent = $('#load-code').value.trimStart().startsWith('MCP1.') ? '添加存档片段' : '查看这份存档'; message(''); }
    $('#load-code').oninput = loadInput;
    $('#clear-parts').onclick = () => { collected = null; $('#load-parts').hidden = true; $('#load-code').value = ''; loadInput(); };
    async function inspect(text, json = false, image = false) {
      const token = ++importToken;
      candidate = null; $('#load-preview').hidden = true; $('#inspect-save').disabled = true;
      $('#load-code').disabled = true; $('#choose-save-file').disabled = true; $('#restore-save-backup').disabled = true;
      $('#choose-save-image').disabled = true;
      $('#clear-parts').disabled = true;
      message(image ? '正在读取存档图片…' : '正在检查存档…');
      try {
        const result = await work(image ? { action: 'image-decode', file: text } : { action: json || text.trimStart().startsWith('{') ? 'json' : 'decode', text }, signal);
        if (!alive() || token !== importToken) return;
        candidate = api.restore(result.save);
        summary($('#load-summary'), candidate); $('#load-preview').hidden = false;
        message('');
        $('#load-preview').scrollIntoView({ block: 'nearest' });
      } catch (error) { if (token === importToken) message(error.message, true); }
      finally { if (alive() && token === importToken) { $('#load-code').disabled = false; $('#inspect-save').disabled = !$('#load-code').value.trim(); $('#choose-save-file').disabled = false; $('#choose-save-image').disabled = false; $('#restore-save-backup').disabled = false; $('#clear-parts').disabled = false; } }
    }
    $('#choose-save-image').onclick = () => $('#import-save-image').click();
    $('#import-save-image').onchange = async e => {
      const file = e.target.files?.[0]; if (!file) return;
      candidate = null; importToken++; $('#load-preview').hidden = true; tab('load');
      $('#load-image-name').textContent = file.name; $('#load-image-name').hidden = false;
      try {
        if (file.size > MAX_IMAGE_FILE) { message('图片超过 32 MB，请选择保存的原图。', true); return; }
        await inspect(file, false, true);
      } finally { e.target.value = ''; }
    };
    $('#inspect-save').onclick = () => {
      const text = $('#load-code').value;
      if (!text.trimStart().startsWith('MCP1.')) { inspect(text); return; }
      try {
        const result = collectSaveParts(text, collected); collected = result.state;
        $('#load-parts').hidden = false; $('#load-parts-count').textContent = `已收集 ${collected.parts.size} / ${collected.total} 段`;
        $('#load-code').value = ''; loadInput();
        if (result.code) inspect(result.code); else message('继续粘贴其他片段，收齐后才能读取。顺序不限。');
      } catch (error) { message(error.message, true); }
    };
    $('#cancel-import').onclick = () => { candidate = null; $('#load-preview').hidden = true; message('已取消，当前世界保持原样。'); };
    $('#confirm-import').onclick = () => {
      if (!candidate || !alive()) return;
      try { api.load(candidate); api.dialog.close(); api.notice('存档已读取', { kind: 'success' }); }
      catch (error) { message(error.message, true); }
    };
    $('#export-save').onclick = () => {api.download(new Blob([JSON.stringify(api.snapshot())], { type: 'application/json' }), 'mc-clicker-save.json');api.backedUp?.();};
    $('#choose-save-file').onclick = () => $('#import-save').click();
    $('#import-save').onchange = async e => {
      const file = e.target.files?.[0]; if (!file) return;
      candidate = null; $('#load-preview').hidden = true;
      tab('load');
      if (file.size > 8 * 1024 * 1024) { message('文件超过 8 MB，无法读取。', true); return; }
      try { const text = await file.text(); if (alive()) await inspect(text, true); }
      catch { message('文件未能读取，请重新选择。', true); }
      finally { e.target.value = ''; }
    };
    try { $('#restore-save-backup').hidden = !readImportBackup(localStorage); } catch { /* Code export still works when storage is blocked. */ }
    $('#restore-save-backup').onclick = () => {
      tab('load');
      try {
        const text = readImportBackup(localStorage);
        if (!text) throw Error('没有可恢复的读档前备份。');
        inspect(text, true);
      } catch (error) { message(error.message, true); }
    };
    tab(mode); generate();
  }
  return { open };
}
