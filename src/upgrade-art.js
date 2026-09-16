// Small, hand-drawn pixel silhouettes. Shared shapes describe the part's job;
// materials distinguish tool tiers. No animated canvas or additional renderer.
const shapes = {
  drill: '<path d="M6 2h6v3h2v3h-2v3h-2v3H8v-3H6V8H4V5h2Z" fill="@"/><path d="M6 5h7v2H6zm1 4h5v2H7z" fill="#35443d"/>',
  twin: '<path d="M2 2h12v3H2zM3 5h3v6H5v3H4v-3H3zm7 0h3v6h-1v3h-1v-3h-1z" fill="@"/>',
  cooling: '<path d="M2 4h6v10H2zM4 2h2v2H4z" fill="#79abb4"/><path d="M10 3h2v11h-2zm3 1h2v9h-2zM3 7h4v2H3z" fill="@"/>',
  hopper: '<path d="M1 3h14v3H1zM3 6h10v3H3zM5 9h6v2H5zM7 11h2v4H7z" fill="@"/><path d="M4 3h8v2H4z" fill="#35443d"/>',
  arm: '<path d="M1 12h7v3H1zM3 3h3v9H3zM6 3h7v3H6zM11 6h3v3h-3zM10 9h5v3h-2v-1h-1v1h-2z" fill="@"/>',
  furnace: '<path d="M2 2h12v12H2z" fill="@"/><path d="M4 4h8v3H4zm0 5h8v4H4z" fill="#35443d"/><path d="M6 10h2v2h2v1H5v-2h1z" fill="#ecb35b"/>',
  fan: '<path d="M2 2h12v12H2z" fill="#71847e"/><path d="M4 4h4v3h4v4H9V8H5V7H4z" fill="@"/><path d="M7 7h2v2H7z" fill="#35443d"/>',
  wind: '<path d="M7 1h3v5H7zM10 6h5v3h-5zM6 9h3v6H6zM1 6h5v3H1z" fill="@"/><path d="M6 6h4v4H6z" fill="#71847e"/>',
  gear: '<path d="M6 1h4v2h3v3h2v4h-2v3h-3v2H6v-2H3v-3H1V6h2V3h3z" fill="@"/><path d="M6 6h4v4H6z" fill="#35443d"/>',
  coil: '<path d="M2 2h12v3H5v6h6V8H8V6h6v8H2z" fill="@"/>',
  torch: '<path d="M3 1h4v5H3zm6 3h4v5H9z" fill="#d47460"/><path d="M4 6h2v7H4zm6 3h2v4h-2zM1 13h14v2H1z" fill="@"/>',
  box: '<path d="M2 3h12v11H2z" fill="@"/><path d="M2 6h12v2H2zM4 3h2v11H4zm6 0h2v11h-2z" fill="#6c5940"/><path d="M7 6h2v4H7z" fill="#efc473"/>',
  rail: '<path d="M2 3h12v7H2z" fill="@"/><path d="M3 10h3v3H3zm7 0h3v3h-3zM1 14h14v1H1z" fill="#71847e"/><path d="M5 3h2v6H5zm4 0h2v6H9z" fill="#6c5940"/>',
  plant: '<path d="M7 3h2v10H7zM3 4h4v3H3zm6-3h4v4H9zM3 8h4v3H3z" fill="@"/><path d="M2 13h12v2H2z" fill="#b18a54"/>',
  water: '<path d="M7 1h2v3h2v3h2v5h-2v2H5v-2H3V7h2V4h2z" fill="#79abb4"/><path d="M5 9h2v3H5z" fill="#d5e8df"/>',
  trough: '<path d="M1 6h14v6H1zM3 12h2v3H3zm8 0h2v3h-2z" fill="@"/><path d="M3 4h4v4H3zm5-1h5v5H8z" fill="#9ba85d"/>',
  book: '<path d="M1 2h6v1h2V2h6v11H9v1H7v-1H1z" fill="@"/><path d="M7 4h2v9H7zM3 5h3v1H3zm7 0h3v1h-3zM3 8h3v1H3zm7 0h3v1h-3z" fill="#6c5940"/>',
  heat: '<path d="M7 1h3v4h3v3h2v5h-2v2H3v-2H1V8h3V5h3z" fill="@"/><path d="M7 8h2v3h2v3H5v-3h2z" fill="#f2cb73"/>',
  relay: '<path d="M1 5h5v6H1zm9 0h5v6h-5zM6 7h4v2H6z" fill="@"/><path d="M3 2h2v2H3zm8 10h2v2h-2z" fill="#ccb6dc"/>',
  bottle: '<path d="M5 1h6v3H5zM6 4h4v3h3v7H3V7h3z" fill="#a3c4bd"/><path d="M5 9h6v4H5z" fill="@"/>',
};
const families = {
  drill:['drill-steel','drill-diamond','drill-netherite'], twin:['drill-twin'], cooling:['drill-cooling'],
  hopper:['drill-buffer','furnace-feed'], arm:['drill-outlet','rail-loader','shulker-dock'],
  furnace:['furnace-core','furnace-lining','blaze-chamber','forge-anvil'], fan:['furnace-blower'],
  wind:['wind-blades'], gear:['wind-gears'], coil:['wind-coils','torch-core','torch-module','shulker-coil'],
  torch:['torch-bank'], box:['store-shelves','store-compress','store-sort','piglin-crates','shulker-cells','dragon-rig'],
  rail:['rail-wagons','rail-dispatch','farm-cart','ghast-harness'], water:['farm-irrigation'],
  plant:['farm-beds','chorus-roots','terrarium-climate'], trough:['pen-feed','magma-press'],
  book:['pen-tools','market-pack','market-orders','library-tools','piglin-contract'],
  heat:['blaze-reservoir','blaze-feed','blaze-exchanger'],
  relay:['nether-customs','end-anchor','end-relay','ender-routing','dragon-route'], bottle:['brew-cooling'],
};
export const UPGRADE_ART = Object.fromEntries(Object.entries(families).flatMap(([shape,ids])=>ids.map(id=>[id,shape])));
export function upgradeArt(row) {
  const color = row.id === 'drill-diamond' ? '#65c6c5' : row.id === 'drill-netherite' ? '#a194a1' :
    row.owner[0]==='E' ? '#b5a0d0' : row.owner[0]==='N' ? '#d68b61' : row.owner[0]==='V' ? '#b5b976' :
    /wind|torch/.test(row.id) ? '#c5a467' : '#a7b8ad';
  return `<svg class="mod-art" viewBox="0 0 16 16" width="32" height="32" aria-hidden="true" shape-rendering="crispEdges">${shapes[UPGRADE_ART[row.id]].replaceAll('@',color)}</svg>`;
}
