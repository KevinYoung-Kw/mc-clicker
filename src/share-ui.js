import {createCardPanel} from './share-card-ui.js';
import {GAME_SHARE_URL,shareLinkData,shareImageData,supportsShare,systemShare} from './share-platform.js';
import {icon} from './icons.js';
import './share-style.css';
export function createShareUI(api){
 return createCardPanel(api,{
  saveLabel:'保存图片',savedLabel:'图片已下载，也可以长按图片保存。',
  actions:`<button id="native-share-image" disabled>${icon('share',18)} 分享图片</button>`,
  extra:`<details class="share-invitation"><summary>邀请朋友一起建造 ${icon('chevron',14)}</summary><div class="share-link-row"><img class="share-qr-image" src="${import.meta.env.BASE_URL}share/world-invite.svg" width="120" height="120" alt="游戏网址二维码"><div><label for="share-url">游戏链接</label><input id="share-url" aria-label="游戏分享链接" readonly value="${GAME_SHARE_URL}"><div class="share-link-actions"><button id="copy-link">复制链接</button><button id="native-share-link">分享网址</button></div></div></div></details>`,
  ready({panel,prepared,busy}){panel.querySelector('#native-share-image').disabled=busy||!prepared||!supportsShare(navigator,shareImageData(prepared?.file,prepared?.label));},
  bind({q,note,perform}){
   q('#native-share-image').onclick=()=>perform(async card=>{
    const result=await systemShare(navigator,shareImageData(card.file,card.label));
    note(result==='shared'?'已交给系统分享。':result==='cancelled'?'已取消分享。':'当前浏览器暂不支持图片分享，可以先保存图片。');
   });
   q('#native-share-link').disabled=!supportsShare(navigator,shareLinkData());
   q('#native-share-link').onclick=async()=>{const r=await systemShare(navigator,shareLinkData());note(r==='shared'?'已交给系统分享。':r==='cancelled'?'已取消分享。':'暂时无法分享，可以复制链接。');};
   q('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText(GAME_SHARE_URL);note('游戏链接已复制。');}catch{q('#share-url').focus();q('#share-url').select();note('链接已选中，请复制。');}};
  }
 });
}
