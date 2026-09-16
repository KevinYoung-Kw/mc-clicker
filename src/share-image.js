// Use an actual PNG <img> so embedded browsers can offer their native save menu.
// Data URLs keep the image available while the user is holding it; there is no
// short-lived object URL to revoke during the browser's save operation.
export async function shareImagePreview(blob, label) {
  const url = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error('图片未能读取'));
    reader.onabort = () => reject(Error('图片已取消'));
    reader.readAsDataURL(blob);
  });
  const image = new Image();
  image.alt = label;
  image.className = 'share-card-image';
  image.setAttribute('aria-describedby', 'image-save-hint');
  const loaded=new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('图片未能显示'));});
  image.src = url;
  await loaded;
  return image;
}
