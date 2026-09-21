/* The menu cursor is the midpoint of two joined existing hand markers. */
(function(root) {
    function valid(p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.vis??p.visibility??1)>=.5;}
    function joinedCursor(screenPoints){
        const sl=screenPoints?.[11],sr=screenPoints?.[12],wl=screenPoints?.[15],wr=screenPoints?.[16];
        if(!valid(sl)||!valid(sr)||!valid(wl)||!valid(wr))return null;
        const shoulderWidth=Math.hypot(sl.x-sr.x,sl.y-sr.y);
        const handDistance=Math.hypot(wl.x-wr.x,wl.y-wr.y);
        // Hands must meet. This avoids accidental menu movement while the player is running.
        if(shoulderWidth<8 || handDistance>shoulderWidth*.8)return null;
        return {
            x:(wl.x+wr.x)/2,y:(wl.y+wr.y)/2,
            vis:Math.min(wl.vis,wr.vis),handDistance,shoulderWidth
        };
    }
    function inRect(p,x,y,w,h){return !!p&&p.x>=x&&p.x<=x+w&&p.y>=y&&p.y<=y+h;}
    const api={joinedCursor,inRect};
    if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MenuInput=api;
})(typeof globalThis!=='undefined'?globalThis:window);
