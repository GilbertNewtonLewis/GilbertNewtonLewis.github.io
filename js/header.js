$(document).ready((function(){var e=$(".header-nav-menubtn"),o=$(".header-nav-menu"),n=$(".header-nav-menu-item"),t=$(".header-nav-submenu"),i=e.is(":visible"),a=!1,s=!1;function l(){n.velocity({height:n.outerHeight()},{complete:function(){t.css({display:"none",opacity:0})}})}$(window).on("resize",Stun.utils.throttle((function(){(i=e.is(":visible"))?(t.removeClass("hide--force"),s&&(l(),s=!1)):t.css({display:"none",opacity:0})}),200));var c=!0,d=$(".mode");$(document).on("click",(function(){o.is(":visible")&&(i&&s&&(l(),s=!1),o.css({display:"none"}),a=!1),c&&(d.removeClass("mode--focus"),c=!1)})),Stun.utils.pjaxReloadHeader=function(){if(e=$(".header-nav-menubtn"),o=$(".header-nav-menu"),n=$(".header-nav-menu-item"),t=$(".header-nav-submenu"),i=e.is(":visible"),a=!1,s=!1,CONFIG.nightMode&&CONFIG.nightMode.enable){var r=!1,u="night_mode";d=$(".mode"),c=!0,!function(){var e=!1;try{parseInt(Stun.utils.Cookies().get(u))&&(e=!0)}catch(e){}return e}()?r=!1:(d.addClass("mode--checked"),d.addClass("mode--focus"),$("html").addClass("nightmode"),r=!0),$(".mode").on("click",(function(e){e.stopPropagation(),r=!r,c=!0,Stun.utils.Cookies().set(u,r?1:0),d.toggleClass("mode--checked"),d.addClass("mode--focus"),$("html").toggleClass("nightmode")}))}e.on("click",(function(e){e.stopPropagation(),i&&a&&s&&(l(),s=!1),a=!a,o.velocity("stop").velocity({opacity:a?1:0},{duration:a?200:0,display:a?"block":"none"})}));var h=!1;$(".header-nav-submenu-item").on("click",(function(){h=!0})),n.on("click",(function(e){if(i){var o=$(this).find(".header-nav-submenu");if(o.length){h?h=!1:e.stopPropagation();var t=n.outerHeight(),a=t+Math.floor(o.outerHeight())*o.length,l=0;$(this).outerHeight()>t?(s=!1,l=t):(s=!0,l=a),o.css({display:"block",opacity:1}),$(this).velocity("stop").velocity({height:l},{duration:300}).siblings().velocity({height:t},{duration:300})}}})),n.on("mouseenter",(function(){var e=$(this).find(".header-nav-submenu");e.length&&(e.is(":visible")||(i?e.css({display:"block",opacity:1}):(e.removeClass("hide--force"),e.velocity("stop").velocity("transition.slideUpIn",{duration:200}))))})),n.on("mouseleave",(function(){var e=$(this).find(".header-nav-submenu");e.length&&(i||(e.addClass("hide--force"),s=!1))}))},Stun.utils.pjaxReloadScrollIcon=function(){CONFIG.header&&CONFIG.header.scrollDownIcon&&$(".header-banner-arrow").on("click",(function(e){e.stopPropagation(),$("#container").velocity("scroll",{offset:$("#header").outerHeight()})}))},Stun.utils.pjaxReloadHeader(),Stun.utils.pjaxReloadScrollIcon()}));