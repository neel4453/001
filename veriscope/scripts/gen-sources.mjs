/**
 * One-time/occasional generator for src/data/sources.json.
 * The JSON is the maintained artifact; this script exists so bulk edits stay reviewable.
 * Every URL entry is marked accessStatus 'not-checked': this build environment cannot
 * verify live sites (network restricted), and the spec forbids claiming untested status.
 */
import { writeFileSync } from 'node:fs';

const CATS = {
  fc: 'fact-checking', un: 'un-mun', gov: 'government', pol: 'politics', cs: 'country-statistics',
  ac: 'academic', news: 'news', soc: 'social-media', media: 'images-video', health: 'health',
  env: 'environment', law: 'law', fin: 'finance', cyber: 'cybersecurity', ref: 'reference',
};

/** Default: manual-first, homepage navigation. search = search template. api = key-free public API adapter. */
const rows = [
  // A. Fact-checking organizations
  ['Google Fact Check Explorer','https://toolbox.google.com/factcheck/explorer','ddg:toolbox.google.com/factcheck','fc'],
  ['PolitiFact','https://www.politifact.com','wp:?s=','fc','us'],
  ['FactCheck.org','https://www.factcheck.org','wp:?s=','fc','us'],
  ['Snopes','https://www.snopes.com','wp:?s=','fc'],
  ['Reuters Fact Check','https://www.reuters.com/fact-check/',null,'fc','news'],
  ['Associated Press Fact Check','https://apnews.com/hub/fact-check',null,'fc','news'],
  ['AFP Fact Check','https://factcheck.afp.com',null,'fc'],
  ['Full Fact','https://fullfact.org','wp:?s=','fc','gb'],
  ['Lead Stories','https://leaddstories.com','wp:?s=','fc'],
  ['Science Feedback','https://sciencefeedback.co','wp:?s=','fc'],
  ['Health Feedback','https://healthfeedback.org','wp:?s=','fc'],
  ['Africa Check','https://africacheck.org','wp:?s=','fc','africa'],
  ['BOOM Live','https://www.boomlive.in','wp:?s=','fc','in'],
  ['Alt News','https://altnews.in','wp:?s=','fc','in'],
  ['Factly','https://factly.in','wp:?s=','fc','in'],
  ['Newschecker','https://www.newschecker.in',null,'fc','in'],
  ['The Quint WebQoof','https://www.thequint.com/webqoof',null,'fc','in'],
  ['Vishvas News','https://www.vishvasnews.com',null,'fc','in'],
  ['Logically Facts','https://www.logicallyfacts.com','wp:?s=','fc'],
  // B. UN and MUN sources
  ['United Nations','https://www.un.org',null,'un'],
  ['UN Digital Library','https://digitallibrary.un.org','q:?q=','un'],
  ['UN Official Document System','https://documents.un.org',null,'un','Manual navigation: ODS search requires knowing document symbols.'],
  ['UN Treaty Collection','https://treaties.un.org','q:?q=','un'],
  ['UN General Assembly','https://www.un.org/ga',null,'un'],
  ['UN Security Council','https://www.un.org/securitycouncil',null,'un'],
  ['UN Human Rights Office','https://www.ohchr.org',null,'un law'],
  ['International Court of Justice','https://www.icj-cij.org',null,'un law'],
  ['International Criminal Court','https://www.icc-cpi.int',null,'un law'],
  ['UNHCR','https://www.unhcr.org','q:?q=','un'],
  ['UNICEF','https://www.unicef.org',null,'un'],
  ['WHO','https://www.who.int',null,'un health'],
  ['World Bank','https://www.worldbank.org',null,'un cs'],
  ['IMF','https://www.imf.org',null,'un fin'],
  ['WTO','https://www.wto.org',null,'un'],
  ['ILO','https://www.ilo.org',null,'un law'],
  ['UN OCHA','https://www.unocha.org',null,'un'],
  ['UNEP','https://www.unep.org',null,'un env'],
  ['IAEA','https://www.iaea.org',null,'un'],
  ['UNDP','https://www.undp.org',null,'un'],
  ['UN Statistics Division','https://unstats.un.org',null,'un cs'],
  ['UN Population Division','https://population.un.org',null,'un cs'],
  ['UN Women','https://www.unwomen.org',null,'un'],
  ['UNODC','https://www.unodc.org',null,'un law'],
  ['UNFCCC','https://unfccc.int',null,'un env'],
  ['IPCC','https://www.ipcc.ch',null,'un env'],
  ['OECD','https://www.oecd.org',null,'un cs'],
  ['European Union','https://european-union.europa.eu',null,'un gov','eu'],
  ['Eurostat','https://ec.europa.eu/eurostat',null,'un cs','eu'],
  ['African Union','https://au.int',null,'un','africa'],
  ['ASEAN','https://asean.org',null,'un'],
  ['NATO','https://www.nato.int',null,'un'],
  ['ICRC','https://www.icrc.org',null,'un law'],
  ['SIPRI','https://www.sipri.org',null,'un'],
  // C. Country profiles & international statistics
  ['CIA World Factbook (archive)','https://www.cia.gov/the-world-factbook/',null,'cs gov','world','Discontinued 2026 — treat as ARCHIVED historical data; do not assume current. accessStatus should remain not-checked until verified.'],
  ['World Bank Open Data API','https://api.worldbank.org','api:worldbank','cs','world','API adapter not implemented in v1 — used as a documented link only.'],
  ['UN Data','https://data.un.org',null,'cs'],
  ['IMF Data','https://www.imf.org/en/Data',null,'cs fin'],
  ['WHO Data','https://data.who.int',null,'cs health'],
  ['FAOSTAT','https://www.fao.org/faostat',null,'cs'],
  ['UNESCO Institute for Statistics','https://uis.unesco.org',null,'cs'],
  ['ITU Statistics','https://www.itu.int/en/ITU-D/Statistics',null,'cs'],
  ['IEA Data','https://www.iea.org/data-and-statistics',null,'cs env'],
  ['WMO','https://wmo.int',null,'cs env'],
  ['Global Carbon Project','https://www.globalcarbonproject.org',null,'env'],
  ['Global Forest Watch','https://www.globalforestwatch.org',null,'env'],
  ['REST Countries API','https://restcountries.com','api:restcountries','cs'],
  ['OECD Data','https://data.oecd.org',null,'cs'],
  ['National statistical agencies (via official portals)','https://unstats.un.org/home/',null,'cs','world','Start from the UN statistics division country directory.'],
  // D. India
  ['India.gov.in','https://www.india.gov.in',null,'gov pol','in'],
  ['Press Information Bureau','https://pib.gov.in','q:?KEY=','gov pol','in'],
  ['PIB Fact Check','https://pib.gov.in/factcheck.html',null,'fc','in','Manual: uses interactive archive; narrow by date on site.'],
  ['Parliament of India','https://sansad.in',null,'gov law pol','in'],
  ['PRS Legislative Research','https://www.prsindia.org','q:?search_api_fulltext=','gov law pol','in'],
  ['India Code','https://www.indiacode.nic.in','q:?searchword=','law gov','in'],
  ['e-Gazette of India','https://egazette.gov.in',null,'law gov','in'],
  ['Supreme Court of India','https://main.sci.gov.in',null,'law','in'],
  ['eCourts','https://ecourts.gov.in',null,'law','in'],
  ['Election Commission of India','https://www.eci.gov.in',null,'pol gov','in'],
  ['data.gov.in','https://data.gov.in','q:?keyword=','cs gov','in'],
  ['MoSPI','https://mospi.gov.in',null,'cs gov','in'],
  ['Reserve Bank of India','https://www.rbi.org.in',null,'fin gov','in'],
  ['NITI Aayog','https://www.niti.gov.in',null,'gov','in'],
  ['CAG India','https://www.cag.gov.in',null,'gov fin law','in'],
  ['Ministry of External Affairs','https://www.mea.gov.in',null,'gov un pol','in'],
  ['Ministry of Home Affairs','https://www.mha.gov.in',null,'gov law','in'],
  ['Ministry of Finance','https://www.indiabudget.gov.in',null,'gov fin','in'],
  ['National Crime Records Bureau','https://ncrb.gov.in',null,'cs law','in'],
  ['NHRC India','https://nhrc.nic.in',null,'law','in'],
  ['ICMR','https://www.icmr.gov.in',null,'health academic','in'],
  ['ISRO','https://www.isro.gov.in',null,'gov','in'],
  ['India Meteorological Department','https://mausam.imd.gov.in',null,'env gov','in'],
  ['Central Pollution Control Board','https://cpcb.gov.in',null,'env gov','in'],
  // E. Other governments & legislation
  ['US Congress','https://www.congress.gov','q:?keyword=','law gov pol','us'],
  ['US Government Publishing Office','https://www.govinfo.gov','q:?q=','gov law','us'],
  ['Federal Register','https://www.federalregister.gov','q:?conditions%5Bterm%5D=','gov law','us'],
  ['US Code','https://uscode.house.gov','q:?req=','law','us'],
  ['US Supreme Court','https://www.supremecourt.gov',null,'law','us'],
  ['US Census Bureau','https://www.census.gov',null,'cs','us'],
  ['US Bureau of Labor Statistics','https://www.bls.gov',null,'cs','us'],
  ['Federal Reserve (FRED)','https://fred.stlouisfed.org','q:?q=','fin cs','us'],
  ['CDC','https://www.cdc.gov','q:?query=','health gov','us'],
  ['FDA','https://www.fda.gov','q:?query=','health gov','us'],
  ['UK Parliament','https://www.parliament.uk','q:?q=','gov law pol','gb'],
  ['UK Legislation','https://www.legislation.gov.uk','q:?query=','law gov','gb'],
  ['UK Office for National Statistics','https://www.ons.gov.uk',null,'cs','gb'],
  ['EUR-Lex','https://eur-lex.europa.eu','q:?q=','law gov','eu'],
  ['European Commission','https://commission.europa.eu',null,'gov','eu'],
  ['Statistics Canada','https://www.statcan.gc.ca','q:?SearchText=','cs','ca'],
  ['Australian Bureau of Statistics','https://www.abs.gov.au','q:?queryText=','cs','au'],
  ['Japan Statistics Bureau','https://www.stat.go.jp',null,'cs','jp'],
  ['Statistics New Zealand','https://www.stats.govt.nz','q:?query=','cs','nz'],
  // F. Academic research
  ['Google Scholar','https://scholar.google.com','q:search?q=','academic','world','Rate-limited; no official API. Manual-first only.'],
  ['OpenAlex API','https://api.openalex.org','api:openalex','academic',null,null,true],
  ['Crossref API','https://api.crossref.org','api:crossref','academic',null,null,true],
  ['Semantic Scholar','https://www.semanticscholar.org','api:semanticscholar','academic',null,null,true],
  ['PubMed','https://pubmed.ncbi.nlm.nih.gov','api:pubmed','academic health',null,null,true],
  ['PubMed Central','https://pmc.ncbi.nlm.nih.gov','q:?term=','academic health'],
  ['Europe PMC','https://europepmc.org','api:europepmc','academic health',null,null,true],
  ['Cochrane Library','https://www.cochranelibrary.com','q:?searchText=','academic health'],
  ['DOAJ','https://doaj.org','q:search?ref=header&query=','academic'],
  ['CORE','https://core.ac.uk','q:search?q=','academic','world','CORE API now requires a free key; treat as optional.'],
  ['OpenAIRE','https://explore.openaire.eu','q:search/find/search-result?q=','academic'],
  ['arXiv','https://arxiv.org','q:search?type=all&query=','academic'],
  ['bioRxiv','https://www.biorxiv.org','q:search/simple%3Fquery%3D','academic'],
  ['medRxiv','https://www.medrxiv.org','q:search/simple%3Fquery%3D','academic'],
  ['SSRN','https://www.ssrn.com','q:/search/?searchterm=','academic fin'],
  ['Zenodo','https://zenodo.org','q:search?q=','academic'],
  ['Figshare','https://figshare.com','q:search/articles?q=','academic'],
  ['DataCite','https://search.datacite.org','q:works?query=','academic'],
  ['ERIC','https://eric.ed.gov','q:?q=','academic'],
  ['Retraction Watch','https://retractionwatch.com','wp:?s=','academic','world','Database search itself needs a free registration; site search is open.'],
  ['PubPeer','https://pubpeer.com','q:search?q=','academic'],
  ['Shodhganga','https://shodhganga.inflibnet.ac.in',null,'academic','in'],
  ['ORCID','https://orcid.org','q:search/?q=','academic'],
  ['Research Organization Registry','https://ror.org','q:search?q=','academic'],
  // G. News and investigations
  ['BBC News','https://www.bbc.com/news','q:search?q=','news'],
  ['Reuters','https://www.reuters.com','q:site-search/?query=','news'],
  ['Associated Press','https://apnews.com','q:search?query=','news'],
  ['The Guardian','https://www.theguardian.com','q:search?q=','news'],
  ['NPR','https://www.npr.org','q:search?q=','news','us'],
  ['PBS News','https://www.pbs.org/newshour','q:search/?query=','news','us'],
  ['Deutsche Welle','https://www.dw.com','q:search/en','news'],
  ['France 24','https://www.france24.com','q:en/search?text=','news'],
  ['Al Jazeera','https://www.aljazeera.com','q:?s=','news'],
  ['Financial Times','https://www.ft.com','q:search?q=','news fin','world','Paywalled content: expect restricted access.'],
  ['The Hindu','https://www.thehindu.com','q:search?q=','news','in'],
  ['The Indian Express','https://indianexpress.com','q:?s=','news','in'],
  ['Scroll.in','https://scroll.in','q:search?q=','news','in'],
  ['The Wire','https://thewire.in','q:search?keywords=','news','in'],
  ['Bellingcat','https://www.bellingcat.com','wp:?s=','news media'],
  ['ProPublica','https://www.propublica.org','q:?s=','news','us'],
  ['ICIJ','https://www.icij.org','q:?s=','news fin law'],
  ['OCCRP','https://www.occrp.org','q:en/search?text=','news'],
  ['GDELT','https://www.gdeltproject.org','api:gdelt','news'],
  // H. Social media
  ['YouTube','https://www.youtube.com/results?search_query={query}',true,'news media soc',null,null,false,'Automated API requires a free Google key (quota); scraping ToS-restricted. Manual-first.'],
  ['Reddit (public JSON)','https://www.reddit.com/search.json?q={query}',true,'soc news',null,null,false,'Rate limits and ToS apply; user-initiated navigation only.'],
  ['X (Twitter)','https://x.com/search?q={query}',null,'soc news','world','Login walls restrict automated access; no free read API. Manual-first.'],
  ['Bluesky','https://bsky.app/search?q={query}',true,'soc'],
  ['Mastodon','https://mastodon.social/search?q={query}',true,'soc'],
  ['TikTok','https://www.tiktok.com/search?q={query}',null,'soc media','world','No free API; manual-first.'],
  ['Instagram','https://www.instagram.com/explore/search/keyword/?q={query}',null,'soc media','world','Login required.'],
  ['Facebook','https://www.facebook.com/public/{query}',null,'soc','world','Access restrictions apply.'],
  ['Threads','https://www.threads.net/search?q={query}',null,'soc'],
  ['Telegram (public channels)','https://t.me/s/{query}',null,'soc'],
  ['Discord','https://discord.com',null,'soc','world','No public search; manual-only by design.'],
  ['Wikipedia (search API)','https://en.wikipedia.org','api:wikipedia','ref soc'],
  ['Wikidata','https://www.wikidata.org','q:?search=','ref soc'],
  ['Internet Archive','https://archive.org','q:?query=','media ref soc'],
  ['Wayback Machine','https://web.archive.org','api:wayback','media ref'],
  ['Common Crawl','https://commoncrawl.org',null,'ref','world','Dataset access only; heavy. Use the index API manually.'],
  // I. Image & video verification
  ['Google Lens','https://lens.google.com',null,'media',null,null,false,'Upload-by-URL: https://lens.google.com/uploadbyurl?url=IMAGE_URL (manual).'],
  ['TinEye','https://tineye.com',null,'media',null,null,false,'Free web search; API needs paid RapidAPI key — not integrated.'],
  ['InVID-WeVerify','https://weverify.eu/verification/',null,'media'],
  ['Amnesty Citizen Evidence Lab','https://citizenevidence.amnestyusa.org',null,'media'],
  ['Bellingcat Toolkit','https://bellingcat.gitlab.io/toolkit/',null,'media'],
  ['ExifTool (local CLI)','https://exiftool.org',null,'media','world','Local forensic metadata; VeriScope embeds the open-source exifr reader for basic EXIF/XMP locally.'],
  ['C2PA / Content Credentials','https://c2pa.org','q:contentcredentials.org/verify','media','world','VeriScope reads C2PA-related XMP locally as a heuristic; full validation: use the open-source c2pa-tools CLI.'],
  ['Adobe Content Authenticity','https://contentauthenticity.org',null,'media'],
  ['NASA Earth Observatory','https://earthobservatory.nasa.gov','q:search?k=','media env'],
  ['USGS EarthExplorer','https://earthexplorer.usgs.gov',null,'env media'],
  ['Copernicus Data Space','https://dataspace.copernicus.eu',null,'env media'],
  // J. Health
  ['NIH','https://www.nih.gov','q:?term=','health'],
  ['MedlinePlus','https://medlineplus.gov','q:search.html?q=','health','us'],
  ['NHS','https://www.nhs.uk',null,'health','gb'],
  ['EMA','https://www.ema.europa.eu','q:en/search-results?search=','health','eu'],
  ['CDSCO India','https://cdscoonline.gov.in',null,'health gov','in'],
  ['ClinicalTrials.gov','https://clinicaltrials.gov','q:search?term=','health academic','us'],
  ['FSSAI India','https://www.fssai.gov.in',null,'health gov','in'],
  // K. Environment & weather (rest already listed; fill gaps)
  ['NASA','https://science.nasa.gov','q:search?query=','env'],
  ['NOAA','https://www.noaa.gov','q:?search=','env'],
  ['ECMWF','https://www.ecmwf.int',null,'env'],
  ['Copernicus Climate Change Service','https://climate.copernicus.eu',null,'env'],
  ['NDMA India','https://ndma.gov.in',null,'env gov','in'],
  ['Our World in Data','https://ourworldindata.org','q:?s=','cs env academic'],
  // L. Law & human rights
  ['Cornell Legal Information Institute','https://www.law.cornell.edu',null,'law','us'],
  ['CourtListener','https://www.courtlistener.com','q:?q=','law','us'],
  ['European Court of Human Rights','https://www.echr.coe.int',null,'law'],
  ['HUDOC','https://hudoc.echr.coe.int','q:#{"fulltext":[{query}]}','law'],
  ['Human Rights Watch','https://www.hrw.org','q:search?keys=','law'],
  ['Amnesty International','https://www.amnesty.org','q:search?q=','law'],
  // M. Finance & business
  ['SEBI','https://www.sebi.gov.in',null,'fin gov','in'],
  ['Ministry of Corporate Affairs','https://www.mca.gov.in',null,'fin gov','in'],
  ['NSE India','https://www.nseindia.com',null,'fin','in'],
  ['BSE India','https://www.bseindia.com',null,'fin','in'],
  ['US SEC EDGAR full-text search','https://efts.sec.gov/LATEST/search-index?q={query}',null,'fin gov','us','UI: https://www.sec.gov/edgar/search/ ; API is free with a declared User-Agent.'],
  ['US Bureau of Economic Analysis','https://www.bea.gov',null,'fin cs','us'],
  ['Companies House UK','https://find-and-update.company-information.service.gov.uk','q:search?query=','fin gov','gb'],
  ['OpenCorporates','https://opencorporates.com','q:companies?q=','fin'],
  ['OpenSanctions','https://www.opensanctions.org','q:search/?q=','fin law'],
  ['FATF','https://www.fatf-gafi.org',null,'fin law'],
  ['UN Comtrade','https://comtradeplus.un.org',null,'fin cs','world','Free account required now — treat as optional.'],
  ['UNCTAD','https://unctad.org','q:?keyword=','fin un'],
  // N. Cybersecurity & technology
  ['NIST','https://www.nist.gov','q:?text=','cyber'],
  ['NIST National Vulnerability Database','https://nvd.nist.gov','q:vuln/search/results?form_type=Basic&query=','cyber','us'],
  ['MITRE CVE','https://www.cve.org',null,'cyber','us','cve.org search is unstable; MITRE API: https://cve.circl.lu/api/cve/CVE-ID mirrors freely.'],
  ['MITRE ATT&CK','https://attack.mitre.org','q:?query=','cyber'],
  ['CISA','https://www.cisa.gov','q:?q=','cyber','us'],
  ['CERT-In','https://www.cert-in.org.in',null,'cyber gov','in'],
  ['OWASP','https://owasp.org','q:?s=','cyber'],
  ['ENISA','https://www.enisa.europa.eu',null,'cyber','eu'],
  ['VirusTotal','https://www.virustotal.com','q:gui/search/-/{query}','cyber','world','Public web UI rate-limited; API needs key — optional integration only.'],
  ['OpenSSF','https://openssf.org',null,'cyber'],
  ['Hugging Face Hub','https://huggingface.co','q:?query=','cyber ref'],
  ['Stanford AI Index','https://aiindex.stanford.edu',null,'cyber academic'],
  ['OECD AI Policy Observatory','https://www.oecd.ai','q:?search=','cyber gov'],
  ['AI Incident Database','https://incidentdatabase.ai','q:catalog/search?keyword=','cyber'],
  // O. Reference sources
  ['Encyclopaedia Britannica','https://www.britannica.com','q:search?q=','ref'],
  ['Stanford Encyclopedia of Philosophy','https://plato.stanford.edu',null,'ref academic'],
  ['Merriam-Webster','https://www.merriam-webster.com','q:dictionary/{query}','ref','us'],
  ['Cambridge Dictionary','https://dictionary.cambridge.org','q:search?q={query}&dictionary=english','ref'],
  ['DBpedia','https://www.dbpedia.org','q:sparql?query=','ref'],
  ['Library of Congress','https://www.loc.gov','q:search/?q=','ref','us'],
  ['US National Archives','https://www.archives.gov','q:search?query=','ref gov','us'],
  ['Europeana','https://www.europeana.eu','q:search?f=&q=','ref'],
  ['Smithsonian Institution','https://www.si.edu','q:?term=','ref','us'],
  // Cross-cutting manual fallback
  ['DuckDuckGo (public search)','https://duckduckgo.com/?q={query}',true,'ref news','world',null,true,'Used as the generic site-scoped fallback: "site:domain query".'],
];

function slug(name){return name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function originOf(u){const m=/^(https?:\/\/[^/]+)/.exec(u);return m?m[1]:u;}

const out = [];
for (const r of rows) {
  const name = r[0];
  const home = r[1];
  const search = typeof r[2] === 'string' ? r[2] : null;
  const cats = r[3];
  const country = typeof r[4] === 'string' && !r[4].startsWith('api:') ? r[4] : (typeof r[4]==='boolean' ? null : r[4]);
  const maybeAdapter = [r[5], r[6], r[7]].find((x) => typeof x === 'string' && x.startsWith('api:'));
  let url = home && !home.includes('{query}') ? home : (home ? home.replace(/\?.*$/, '') : 'https://duckduckgo.com/');
  let searchUrl = null;
  let adapter;
  let retrievalMode = 'open-search-page';
  let notes = [r[5], r[6], r[7]].find((x) => typeof x === 'string' && !x.startsWith('api:'));
  if (home && home.includes('{query}')) { searchUrl = home; }
  if (search) {
    if (search.startsWith('ddg:')) {
      searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent('site:' + search.slice(4))}`;
    } else if (search.startsWith('wp:')) {
      searchUrl = `${originOf(home)}${search.slice(3)}{query}`;
    } else if (search.startsWith('q:')) {
      let tail = search.slice(2);
      if (tail.startsWith('/')) tail = tail.slice(1);
      if (!tail.startsWith('?')) tail = '/' + tail;
      searchUrl = tail.includes('{query}') ? `${originOf(home)}${tail}` : `${originOf(home)}${tail}{query}`;
    } else if (search.startsWith('api:')) {
      adapter = search.slice(4);
      retrievalMode = 'public-api-optional';
    }
  }
  const categories = String(cats ?? 'ref').split(/\s+/).map((c) => CATS[c] ?? 'reference');
  const countries = !country || country === 'world' ? ['world'] : [country];
  const sourceType =
    categories.includes('fact-checking') ? 'fact-checker'
    : adapter ? 'reference'
    : categories.includes('academic') ? 'academic'
    : categories.includes('news') || categories.includes('social-media') ? 'news'
    : categories.includes('government') || categories.includes('politics') || categories.includes('country-statistics') || categories.includes('finance') || categories.includes('law') || categories.includes('health') || categories.includes('environment') || categories.includes('un-mun') ? (categories.includes('law') || categories.includes('un-mun') ? 'primary' : 'official-statistics')
    : 'reference';
  const entry = {
    id: slug(name),
    name,
    url,
    searchUrl,
    searchUrlVerified: false,
    categories: [...new Set(categories.length ? categories : ['reference'])],
    countries,
    sourceType,
    retrievalMode,
    accessStatus: 'not-checked',
    apiKeyRequired: false,
    paidServiceRequired: false,
    automationAllowed: !!adapter,
    notes,
    lastChecked: null,
  };
  if (adapter) entry.adapter = adapter;
  const noteTxt = (entry.notes ?? '') + ' ' + (maybeAdapter ?? '');
  if (/paywall|login|account|ToS|restricted|rate/i.test(noteTxt)) entry.accessStatus = 'restricted';
  if (/archive/i.test(noteTxt)) entry.accessStatus = 'historical-archive';
  if (maybeAdapter && typeof maybeAdapter === 'string' && maybeAdapter.startsWith('api:')) {
    entry.adapter = maybeAdapter.slice(4);
    entry.automationAllowed = true;
    entry.retrievalMode = 'public-api-optional';
  }
  out.push(entry);
}

// dedupe by id
const seen = new Map();
for (const e of out) {
  let id = e.id, n = 2;
  while (seen.has(id)) id = `${e.id}-${n++}`;
  e.id = id; seen.set(id, e);
}
out.sort((a,b)=>a.name.localeCompare(b.name));
writeFileSync(new URL('../src/data/sources.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('sources.json entries:', out.length);
