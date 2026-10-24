// Focus changes emphasis, never the cohort or the layout of surrounding records.
/**
 * @param {unknown} base
 * @param {{legendId?:string|null,centerKey?:string|null,legendCenterKey?:string|null}} focus
 * @param {number} dimmed
 */
export function legendFocusOpacity(base,{legendId=null,centerKey=null,legendCenterKey=null}={},dimmed=.3){
 if(legendId)return ['case',['any',['==',['get','id'],legendId],['boolean',['feature-state','hovered'],false]],base,
  ...(legendCenterKey?[['==',['get','centerKey'],legendCenterKey],base]:[]),['*',base,dimmed]];
 if(centerKey)return ['case',['any',['boolean',['feature-state','hovered'],false],['boolean',['feature-state','selected'],false]],base,['==',['get','centerKey'],centerKey],base,['*',base,dimmed]];
 return base;
}
