// Player stories are optional keepsakes, not production facilities.
export const COMMUNITY_SOUVENIRS = [
 {id:'request-pond',name:'需求池',w:2,d:1.5,radius:.3,desc:'小黄鸭浮在石岸水池里，一艘纸船等着「已排期」。',inscription:'没事，怕你没看到，不是催你。',story:'community-pond'},
 {id:'cash-counter',name:'大王提现处',w:1.5,d:1.5,radius:.35,desc:'绿瓦小屋挂着绿宝石招牌，柜员窗里只有一只空钱盘。',inscription:'世界上最富有的女人——大王',story:'community-cash'},
 {id:'village-stage',name:'农村大舞台',w:3,d:2.5,radius:.6,desc:'红柱灰瓦的小戏台，台前留着长凳。村里有梦的人可以来这里。',inscription:'「用心经营我的小游戏。」——蟒蛇\n蟒蛇通关以后，还想把这个世界好好装修一下。她和群里的大家提了不少点子。后来，搬动、转向、收纳、园艺，就一件件有了。',story:'community-stage'},
];
export const SOUVENIR_BY_ID=Object.fromEntries(COMMUNITY_SOUVENIRS.map(i=>[i.id,i]));
export const COMMUNITY_COPY={
 'community-cash':['以前有个叫大王的，挣了不少绿宝石，来问作者如何提现。','这个问题，我也很想知道。','柜台给大王盖好了。钱的事，作者还在想办法。'],
 'community-hold':['传说有个叫南冰的游人，玩得比计算机模拟还快。作者赶紧去问，是不是研究出了什么打法。','他说：“我就是空闲的时候一直长按采集。”','作者看了看自己跑的那些模拟，没说话。'],
 'community-tree':['以前有个叫洛斌的游人，种了一棵树。没种好，那棵树一直在原地转，三百六十度，根本停不下来。','可能是蔡依林的歌听多了。'],
 'community-mansion':['我以前有一套挺大的豪宅。你现在看到的菜单，有好大一片都是我的。','结果玩家以为遇到bug了，作者就把我赶到这个小框里，跟你说话。','我不难过。'],
 'community-overtime':['作者算过，十个人各玩四小时，他就偷走了四十小时。他觉得自己太邪恶了。','群里听完说，那你赶紧把装修模式做了。','现在大家挂机，他加班。'],
 'community-pond':['作者说，大家的建议都进需求池了。','我来看看水位。'],
 'community-stage':['你还真在末地传送门旁边建起村子了。','cure第一次看见这个门，问是不是农村大舞台，有梦你就来。','现在村子有了，给你补个台。别让唱戏的走错门就行。'],
};
export const freshCommunityStories=()=>({version:1,rolled:[],unlocked:[],claimed:[],triggers:{},lastStoryAt:null,backupAt:null});
