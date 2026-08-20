const PAINTERS: [RegExp, string][] = [
  [/van\s*gogh/i, "Vincent van Gogh"],
  [/claude\s*monet|\bmonet\b/i, "Claude Monet"],
  [/vermeer/i, "Johannes Vermeer"],
  [/gustav\s*klimt|\bklimt\b/i, "Gustav Klimt"],
  [/rembrandt/i, "Rembrandt"],
  [/botticelli/i, "Sandro Botticelli"],
  [/hokusai/i, "Katsushika Hokusai"],
  [/hiroshige/i, "Utagawa Hiroshige"],
  [/yoshitoshi/i, "Tsukioka Yoshitoshi"],
  [/\bcezanne\b|\bcézanne\b/i, "Paul Cézanne"],
  [/\bgauguin\b/i, "Paul Gauguin"],
  [/\bseurat\b/i, "Georges Seurat"],
  [/\bdegas\b/i, "Edgar Degas"],
  [/pierre-auguste\s*renoir|\brenois\b|auguste\s*renoir/i, "Pierre-Auguste Renoir"],
  [/\bmanet\b/i, "Édouard Manet"],
  [/\bturner\b/i, "J.M.W. Turner"],
  [/caravaggio/i, "Caravaggio"],
  [/velazquez|velázquez/i, "Diego Velázquez"],
  [/\bgoya\b/i, "Francisco Goya"],
  [/\brubens\b/i, "Peter Paul Rubens"],
  [/\btitian\b/i, "Titian"],
  [/raphael|raffaello/i, "Raphael"],
  [/leonardo da vinci|\bvinci\b/i, "Leonardo da Vinci"],
  [/michelangelo/i, "Michelangelo"],
  [/bruegel/i, "Pieter Bruegel"],
  [/\bwatteau\b/i, "Antoine Watteau"],
  [/canaletto/i, "Canaletto"],
  [/\bconstable\b/i, "John Constable"],
  [/john\s*singer\s*sargent|\bsargent\b/i, "John Singer Sargent"],
  [/mary\s*cassatt/i, "Mary Cassatt"],
  [/berthe\s*morisot/i, "Berthe Morisot"],
  [/toulouse-lautrec/i, "Henri de Toulouse-Lautrec"],
  [/albrecht\s*d[uü]rer|\bdurer\b/i, "Albrecht Dürer"],
  [/\bwhistler\b/i, "James McNeill Whistler"],
  [/prokudin/i, "Sergey Prokudin-Gorsky"],
  [/\bgiotto\b/i, "Giotto"],
  [/\bbosch\b/i, "Hieronymus Bosch"],
  [/el greco/i, "El Greco"],
  [/\bdelacroix\b/i, "Eugène Delacroix"],
  [/\bingres\b/i, "Jean-Auguste-Dominique Ingres"],
  [/caspar david friedrich/i, "Caspar David Friedrich"],
  [/\bmucha\b/i, "Alphonse Mucha"],
  [/\bmondrian\b/i, "Piet Mondrian"],
  [/kandinsky/i, "Wassily Kandinsky"],
  [/\bmalevich\b/i, "Kazimir Malevich"],
  [/fra angelico/i, "Fra Angelico"],
  [/\bgericault\b|\bgéricault\b/i, "Théodore Géricault"],
  [/\bmillais\b/i, "John Everett Millais"],
  [/william morris/i, "William Morris"],
];

const INSTITUTION =
  /library of congress|rawpixel|wikimedia|openverse|flickr|photographer|internet archive|unspecified|various|free public domain/i;

export function isPainting(text: string) {
  return (
    /\b(painting|oil on canvas|watercolou?r|ukiyo-e|woodblock|still life painting|self-portrait|altarpiece|fresco|mural|cave painting|tomb painting|mosaic|fayum|dunhuang|mogao|kizil|qizil|ajanta|sigiriya|nianhua|new year print)\b/i.test(
      text,
    ) || PAINTERS.some(([pattern]) => pattern.test(text))
  );
}

export function isDesign(text: string) {
  return /\b(furniture|chippendale|thonet|shaker furniture|william morris|bauhaus|art nouveau furniture|wiener werkstätte|armchair|sideboard|bentwood|textile|embroidery|batik|kilim|zellige|ikat|kente|iznik|kimono pattern)\b/i.test(
    text,
  );
}

export function isPoster(text: string) {
  return /\b(poster|affiche|wpa|lithograph poster|travel poster|film poster|movie poster)\b/i.test(text);
}

export function creatorLabel(title: string, kind?: "film" | "photo") {
  if (isPainting(title) || isPoster(title) || isDesign(title)) return "创作者";
  if (kind === "film") return "导演";
  return "作者";
}

export function parseCreator(title: string, author?: string) {
  for (const [pattern, name] of PAINTERS) {
    if (pattern.test(title) || (author && pattern.test(author))) return name;
  }
  const years = title.match(/^([A-ZÀ-ÖØ-öø-ÿ][^,(]{1,50}?)\s*\(\d{4}/);
  if (years?.[1] && !INSTITUTION.test(years[1])) return years[1].trim();
  const possessive = title.match(/^([A-ZÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÿ.'\-\s]{1,50}?)'s\s+/);
  if (possessive?.[1] && !INSTITUTION.test(possessive[1])) return possessive[1].trim();
  if (author && !INSTITUTION.test(author) && author.length > 2 && author.length < 80) {
    return author.replace(/<[^>]+>/g, "").trim();
  }
  return "";
}
