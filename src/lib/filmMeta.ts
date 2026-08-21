import "./proxy";

const USER_AGENT = "FilmPalette/1.0 (public-domain film color archive; educational)";
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const FILM_TYPES = new Set([
  "Q11424",
  "Q24862",
  "Q202866",
  "Q229390",
  "Q251102",
  "Q18011172",
  "Q24869",
]);

export type FilmCredits = {
  titleEn: string;
  titleZh: string;
  director: string;
};

const KNOWN: Record<string, FilmCredits> = {
  nosferatu: {
    titleEn: "Nosferatu",
    titleZh: "诺斯费拉图",
    director: "F.W. 茂瑙",
  },
  metropolis: {
    titleEn: "Metropolis",
    titleZh: "大都会",
    director: "弗里茨·朗",
  },
  caligari: {
    titleEn: "The Cabinet of Dr. Caligari",
    titleZh: "卡里加里博士的小屋",
    director: "罗伯特·维内",
  },
  "the kid": {
    titleEn: "The Kid",
    titleZh: "寻子遇仙记",
    director: "查理·卓别林",
  },
  "the general": {
    titleEn: "The General",
    titleZh: "将军号",
    director: "巴斯特·基顿",
  },
  "sherlock jr": {
    titleEn: "Sherlock Jr.",
    titleZh: "福尔摩斯二世",
    director: "巴斯特·基顿",
  },
  "voyage dans la lune": {
    titleEn: "A Trip to the Moon",
    titleZh: "月球旅行记",
    director: "乔治·梅里爱",
  },
  "trip to the moon": {
    titleEn: "A Trip to the Moon",
    titleZh: "月球旅行记",
    director: "乔治·梅里爱",
  },
  "night of the living dead": {
    titleEn: "Night of the Living Dead",
    titleZh: "活死人之夜",
    director: "乔治·A·罗梅罗",
  },
  charade: {
    titleEn: "Charade",
    titleZh: "谜中谜",
    director: "斯坦利·多南",
  },
  "safety last": {
    titleEn: "Safety Last!",
    titleZh: "最后安全",
    director: "弗雷德·C·纽迈耶 / 山姆·泰勒",
  },
  sunrise: {
    titleEn: "Sunrise",
    titleZh: "日出",
    director: "F.W. 茂瑙",
  },
  "joan of arc": {
    titleEn: "The Passion of Joan of Arc",
    titleZh: "圣女贞德蒙难记",
    director: "卡尔·西奥多·德莱叶",
  },
  "all quiet on the western front": {
    titleEn: "All Quiet on the Western Front",
    titleZh: "西线无战事",
    director: "刘易斯·迈尔斯通",
  },
  "his girl friday": {
    titleEn: "His Girl Friday",
    titleZh: "女友礼拜五",
    director: "霍华德·霍克斯",
  },
  "little shop of horrors": {
    titleEn: "The Little Shop of Horrors",
    titleZh: "恐怖小店",
    director: "罗杰·科曼",
  },
  "plan 9": {
    titleEn: "Plan 9 from Outer Space",
    titleZh: "外太空九号计划",
    director: "爱德华·D·伍德",
  },
  faust: {
    titleEn: "Faust",
    titleZh: "浮士德",
    director: "F.W. 茂瑙",
  },
  "pandora's box": {
    titleEn: "Pandora's Box",
    titleZh: "潘多拉的魔盒",
    director: "G.W. 帕布斯特",
  },
  "man with a movie camera": {
    titleEn: "Man with a Movie Camera",
    titleZh: "持摄影机的人",
    director: "吉加·维尔托夫",
  },
  "phantom of the opera": {
    titleEn: "The Phantom of the Opera",
    titleZh: "歌剧魅影",
    director: "鲁珀特·朱利安",
  },
  potemkin: {
    titleEn: "Battleship Potemkin",
    titleZh: "战舰波将金号",
    director: "谢尔盖·爱森斯坦",
  },
  "big buck bunny": {
    titleEn: "Big Buck Bunny",
    titleZh: "超凡兔",
    director: "Sacha Goedegebure",
  },
  sintel: {
    titleEn: "Sintel",
    titleZh: "辛特尔",
    director: "Colin Levy",
  },
  "elephants dream": {
    titleEn: "Elephants Dream",
    titleZh: "大象之梦",
    director: "Bassam Kurdali",
  },
  "tears of steel": {
    titleEn: "Tears of Steel",
    titleZh: "钢之泪",
    director: "Ian Hubert",
  },
  "gold rush": {
    titleEn: "The Gold Rush",
    titleZh: "淘金记",
    director: "查理·卓别林",
  },
  "great train robbery": {
    titleEn: "The Great Train Robbery",
    titleZh: "火车大劫案",
    director: "埃德温·S·鲍特",
  },
  "carnival of souls": {
    titleEn: "Carnival of Souls",
    titleZh: "灵魂狂欢节",
    director: "赫克·哈维",
  },
  "神女": {
    titleEn: "The Goddess",
    titleZh: "神女",
    director: "吴永刚",
  },
  "马路天使": {
    titleEn: "Street Angel",
    titleZh: "马路天使",
    director: "袁牧之",
  },
  "小城之春": {
    titleEn: "Spring in a Small Town",
    titleZh: "小城之春",
    director: "费穆",
  },
  "street angel": {
    titleEn: "Street Angel",
    titleZh: "马路天使",
    director: "袁牧之",
  },
  "spring in a small town": {
    titleEn: "Spring in a Small Town",
    titleZh: "小城之春",
    director: "费穆",
  },
  "king of jazz": {
    titleEn: "King of Jazz",
    titleZh: "爵士之王",
    director: "约翰·默里·安德森 / 保罗·费霍斯",
  },
  "the circus": {
    titleEn: "The Circus",
    titleZh: "马戏团",
    director: "查理·卓别林",
  },
  "toll of the sea": {
    titleEn: "The Toll of the Sea",
    titleZh: "海之殇",
    director: "切斯特·M·富兰克林",
  },
  "becky sharp": {
    titleEn: "Becky Sharp",
    titleZh: "蓓基·夏普",
    director: "鲁本·马莫利安",
  },
  "gulf between": {
    titleEn: "The Gulf Between",
    titleZh: "海湾之间",
    director: "W.S. 范戴克",
  },
  "thief of bagdad": {
    titleEn: "The Thief of Bagdad",
    titleZh: "巴格达窃贼",
    director: "路德维希·贝格尔 / 迈克尔·鲍威尔 / 蒂姆·惠兰",
  },
  "memphis belle": {
    titleEn: "The Memphis Belle",
    titleZh: "孟菲斯美女号",
    director: "威廉·怀勒",
  },
  "sweet smell of success": {
    titleEn: "Sweet Smell of Success",
    titleZh: "成功的滋味",
    director: "亚历山大·麦肯德里克",
  },
  "face of a fugitive": {
    titleEn: "Face of a Fugitive",
    titleZh: "亡命江湖",
    director: "保罗·温德科斯",
  },
  "the night the world exploded": {
    titleEn: "The Night the World Exploded",
    titleZh: "世界爆炸之夜",
    director: "弗雷德·F·西尔斯",
  },
  "people will talk": {
    titleEn: "People Will Talk",
    titleZh: "人言可畏",
    director: "约瑟夫·L·曼凯维奇",
  },
  "follow me quietly": {
    titleEn: "Follow Me Quietly",
    titleZh: "悄悄跟我来",
    director: "理查德·弗莱舍",
  },
};

export function parseFilmTitle(raw: string) {
  let text = raw.replace(/^File:/i, "").replace(/\.[a-z0-9]+$/i, "");
  text = text.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  text = text.replace(/\s+(trailer|screenshot|title|still)s?(\s+\d+)?$/i, "");
  const inMatch = text.match(/\bin\s+(.+)$/i);
  if (inMatch?.[1] && inMatch[1].length > 3) text = inMatch[1];
  text = text.replace(/\s+(trailer|screenshot|title|still)s?(\s+\d+)?$/i, "");
  text = text.replace(/\s*\(\d{4}\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return text.trim();
}

async function wikiGet(params: Record<string, string>) {
  const url = new URL(WIKIDATA);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Wikidata ${response.status}`);
  return response.json() as Promise<Record<string, unknown>>;
}

function labelOf(
  entity: {
    labels?: Record<string, { value?: string }>;
  },
  langs: string[],
) {
  for (const lang of langs) {
    const value = entity.labels?.[lang]?.value;
    if (value) return value;
  }
  return "";
}

function instanceIds(entity: { claims?: Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } } } }[]> }) {
  return (entity.claims?.P31 ?? [])
    .map((claim) => claim.mainsnak?.datavalue?.value?.id)
    .filter((id): id is string => Boolean(id));
}

export function knownCredits(query: string): FilmCredits | null {
  if (!query) return null;
  const q = query.toLowerCase();
  if (KNOWN[q]) return KNOWN[q];
  const hit = Object.keys(KNOWN)
    .filter((key) => (key.length >= 5 || /[\u4e00-\u9fff]/.test(key)) && q.includes(key))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? KNOWN[hit] : null;
}

export async function lookupFilm(query: string): Promise<FilmCredits> {
  const fallback: FilmCredits = {
    titleEn: query || "未注明",
    titleZh: "未注明",
    director: "未注明",
  };
  if (!query) return fallback;
  const known = KNOWN[query.toLowerCase()];
  if (known) return known;

  try {
    const search = await wikiGet({
      action: "wbsearchentities",
      search: query,
      language: "en",
      uselang: "zh",
      type: "item",
      limit: "6",
    });
    const hits = (search.search as { id: string; label?: string }[] | undefined) ?? [];
    if (!hits.length) return fallback;

    const ids = hits.map((hit) => hit.id).join("|");
    const entitiesRes = await wikiGet({
      action: "wbgetentities",
      ids,
      props: "labels|claims",
      languages: "en|zh|zh-hans|zh-cn",
    });
    const entities = (entitiesRes.entities ?? {}) as Record<
      string,
      {
        labels?: Record<string, { value?: string }>;
        claims?: Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } } } }[]>;
      }
    >;

    const film =
      Object.values(entities).find((entity) =>
        instanceIds(entity).some((id) => FILM_TYPES.has(id)),
      ) ?? Object.values(entities)[0];

    if (!film) return fallback;

    const directorIds = (film.claims?.P57 ?? [])
      .map((claim) => claim.mainsnak?.datavalue?.value?.id)
      .filter((id): id is string => Boolean(id));

    let director = "未注明";
    if (directorIds.length) {
      const directorsRes = await wikiGet({
        action: "wbgetentities",
        ids: directorIds.slice(0, 3).join("|"),
        props: "labels",
        languages: "en|zh|zh-hans|zh-cn",
      });
      const directorEntities = Object.values(
        (directorsRes.entities ?? {}) as Record<string, { labels?: Record<string, { value?: string }> }>,
      );
      const names = directorEntities
        .map((entity) => labelOf(entity, ["zh-hans", "zh", "zh-cn", "en"]))
        .filter(Boolean);
      if (names.length) director = names.join(" / ");
    }

    return {
      titleEn: labelOf(film, ["en"]) || query,
      titleZh: labelOf(film, ["zh-hans", "zh", "zh-cn"]) || "未注明",
      director,
    };
  } catch {
    return fallback;
  }
}
