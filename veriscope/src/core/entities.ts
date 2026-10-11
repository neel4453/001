/**
 * Lightweight entity/context extraction: countries, orgs, UN documents, speakers.
 * Rule-based, no model required. Used to enrich queries and flag missing context.
 */

export const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahamas','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia','Botswana',
  'Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic',
  'Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czechia','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada',
  'Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq',
  'Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan',
  'Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi',
  'Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco',
  'Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua',
  'Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Palestinian','Panama',
  'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Samoa',
  'San Marino','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands',
  'Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Türkiye',
  'Turkmenistan','Tuvalu','Uganda','Ukraine','Emirates','United Kingdom','Britain','England','Scotland','Wales',
  'United States','America','Uruguay','Uzbekistan','Vanuatu','Vatican','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

const DEMONYMS: Record<string, string> = {
  american: 'United States', indian: 'India', chinese: 'China', russian: 'Russia', british: 'United Kingdom',
  french: 'France', german: 'Germany', pakistani: 'Pakistan', brazilian: 'Brazil', japanese: 'Japan',
  canadian: 'Canada', australian: 'Australia', mexican: 'Mexico', turkish: 'Türkiye', italian: 'Italy',
  spanish: 'Spain', korean: 'South Korea', ukrainian: 'Ukraine', iranian: 'Iran', iraqi: 'Iraq',
  'south african': 'South Africa', nigerian: 'Nigeria', egyptian: 'Egypt', israeli: 'Israel', palestinian: 'Palestine',
};

export const ORGS = [
  'United Nations','UN','UN Security Council','UN General Assembly','UN Human Rights Council','UNESCO','UNICEF',
  'UNHCR','WHO','World Health Organization','World Bank','IMF','International Monetary Fund','WTO','ILO','UNICEF',
  'OCHA','UNEP','IAEA','UNDP','FAO','IFAD','UNRWA','UNFCCC','IPCC','OECD','European Union','EU','Eurostat',
  'African Union','ASEAN','NATO','ICRC','SIPRI','NATO','ICC','ICJ','International Court of Justice','G20','G7',
  'Supreme Court','Parliament','Congress','SEC','EDGAR','FED','Federal Reserve','CDC','FDA','NIH','NASA','NOAA',
  'USGS','ECMWF','CBI','Reserve Bank of India','RBI','SEBI','ISRO','DRDO','NITI Aayog','Ministry of External Affairs',
  'Ministry of Finance','Ministry of Home Affairs','Election Commission','CAG','NCRB','ICMR','FSSAI','CDSCO',
  'PIB','Press Information Bureau','BBC','Reuters','Associated Press','AP','AFP','AIIM','AIIMS',
];

const COUNTRY_SET = new Set(COUNTRIES.map((c) => c.toLowerCase()));

export interface EntitiesResult {
  countries: string[];
  orgs: string[];
  resolutions: string[];
  treaties: string[];
  people: string[];
}

export function extractEntities(text: string): EntitiesResult {
  const lower = ` ${text.toLowerCase()} `;
  const countries: string[] = [];
  for (const c of COUNTRIES) {
    if (new RegExp(String.raw`\b${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`).test(lower)) {
      countries.push(c);
    }
  }
  for (const [dem, country] of Object.entries(DEMONYMS)) {
    if (new RegExp(String.raw`\b${dem}\b`).test(lower) && !countries.includes(country)) countries.push(country);
  }
  const orgs: string[] = [];
  for (const o of ORGS) {
    if (lower.includes(` ${o.toLowerCase()} `) || lower.includes(`${o.toLowerCase()},`) || new RegExp(String.raw`\b${o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`).test(lower)) {
      if (o.length <= 4 && !new RegExp(String.raw`\b${o}\b`).test(text)) continue; // acronyms case-sensitive
      orgs.push(o);
    }
  }
  const resolutions: string[] = [];
  for (const m of text.matchAll(/\b(?:UN\s+)?(?:Security Council|General Assembly)\s+Resolution\s+(\d+(?:\(\w+\)\d*)?|\d+\/\d+)\b/gi)) {
    resolutions.push(m[0]);
  }
  for (const m of text.matchAll(/\bResolution\s+(\d{2,4})\b/gi)) {
    if (!resolutions.some((r) => r.includes(m[1]))) resolutions.push(m[0]);
  }
  const treaties: string[] = [];
  for (const m of text.matchAll(
    /\b((?:Paris|Kyoto|Kigali|Geneva|Vienna|Oslo|Camp David|Dayton|Maastricht|Lisbon|Tlatelolco|Rokkako|Anchorage)?\s*(?:Treaty|Convention|Protocol|Covenant|Accord|Agreement|Charter|Framework Convention|Ceasefire Agreement)(?:\s+of\s+\d{4})?)\b/gi,
  )) {
    treaties.push(m[1].replace(/\s+/g, ' ').trim());
  }
  for (const m of text.matchAll(/\bArticle\s+(\d+[a-zA-Z]?)\b/g)) treaties.push(m[0]);
  const people: string[] = [];
  const said =
    /\b(?:said|says|stated|claimed|argued|told|according to)\s+(?:Mr\.?|Ms\.?|Dr\.?|President|Prime Minister|Secretary|PM|FM)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g;
  for (const m of text.matchAll(said)) people.push(m[1]);
  return { countries, orgs, resolutions, treaties, people };
}

export function mentionsCountry(text: string, country: string): boolean {
  return COUNTRY_SET.has(country.toLowerCase()) || text.toLowerCase().includes(country.toLowerCase());
}
