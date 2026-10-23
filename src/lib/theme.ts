export const THEME_KEY = "den.theme";

/** Runs before the page paints, so a saved choice never flashes the wrong colours. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",t==="dark"?"#0F171D":"#FFFFFF");}}catch(e){}`;
