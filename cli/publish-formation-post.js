// Publish the "Formation Nouvelles Technologies" blog post in French
const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const env = {};
envFile.split('\n').forEach(l => { const [k,v] = l.split('='); if (k && v) env[k.trim()] = v.trim(); });
const WP_URL = env.WP_URL;
const WP_USER = env.WP_USER;
const WP_APP_PASSWORD = env.WP_APP_PASSWORD;
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');

async function wpAPI(method, endpoint, body) {
  const url = `${WP_URL}/wp-json/wp/v2/${endpoint}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function getOrCreateTerm(taxonomy, name) {
  const search = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
  const found = search.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (found) return found.id;
  try {
    const created = await wpAPI('POST', taxonomy, { name });
    return created.id;
  } catch (e) {
    const retry = await wpAPI('GET', `${taxonomy}?search=${encodeURIComponent(name)}&per_page=5`);
    const f = retry.find(t => t.name.toLowerCase() === name.toLowerCase());
    return f ? f.id : null;
  }
}

async function uploadFeaturedImage() {
  try {
    const imageUrl = 'https://loremflickr.com/1200/630/morocco,business,technology?lock=77';
    const imgRes = await fetch(imageUrl, { redirect: 'follow' });
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `formation-transformation-digitale-maroc-${Date.now()}.jpg`;

    const uploadRes = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'image/jpeg',
      },
      body: buffer,
    });
    const media = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(`Upload failed: ${JSON.stringify(media)}`);
    await wpAPI('POST', `media/${media.id}`, {
      alt_text: 'Formation transformation digitale pour PME et TPE au Maroc'
    });
    console.log(`  ✓ Featured image uploaded (ID: ${media.id})`);
    return media.id;
  } catch (e) {
    console.warn(`  ⚠ Featured image failed: ${e.message}`);
    return null;
  }
}

const BRIEF_URL = 'https://cms.drissi.xyz/wp-content/uploads/2026/03/formation_executive_brief.pdf';
const TOC_URL = 'https://cms.drissi.xyz/wp-content/uploads/2026/03/formation_toc_complet.pdf';

const title = 'Transformation Digitale des PME au Maroc : 9 Leviers Concrets pour 2026';
const slug = 'transformation-digitale-pme-maroc-2026';
const excerpt = 'Le cadre réglementaire marocain impose la facturation électronique, la CNDP renforce ses contrôles, et le e-commerce local croît de 30\u202f% par an. Cette formation de 9 modules couvre le marketing digital, la vente en ligne, la cybersécurité, le cadre juridique et la productivité par l\'IA — avec un plan d\'action sur 30 jours.';

const content = `<h2>Le contexte marocain a changé plus vite que la plupart des entreprises</h2>
<p>Entre 2020 et 2026, le paysage numérique marocain a subi une compression que d'autres marchés ont mis une décennie à traverser. La pandémie a accéléré l'adoption du paiement en ligne via CMI, la DGI a annoncé l'obligation de facturation électronique pour 2026, et la CNDP — longtemps perçue comme un organe passif — a lancé une série de contrôles ciblés sur les fichiers clients des PME en application de la loi 09-08. Parallèlement, la stratégie <strong>Maroc Digital</strong> et la feuille de route <strong>Maroc IA 2030</strong> ont repositionné le numérique comme priorité économique nationale.</p>
<p>Le résultat : les entreprises qui n'ont pas encore amorcé leur transition digitale ne sont plus simplement "en retard". Elles opèrent dans un environnement réglementaire et concurrentiel qui a été redessiné autour d'outils qu'elles n'utilisent pas encore. Le e-commerce marocain croît de 30\u202f% par an. Les consommateurs comparent sur Instagram avant de se déplacer. Les appels d'offres publics passent par <a href="https://directentreprise.ma" target="_blank" rel="noopener">directentreprise.ma</a>. Ignorer ces canaux, c'est renoncer à une part croissante du marché.</p>
<p>C'est dans ce contexte que j'ai structuré un programme de formation en 9 modules, chacun conçu pour répondre à un levier spécifique de la transformation digitale d'une PME ou TPE marocaine. Pas de théorie déconnectée du terrain. Chaque module s'appuie sur le cadre juridique marocain, les outils de paiement locaux (CMI, CashPlus, Inwi Money), et les réalités opérationnelles d'une entreprise de 2 à 50 salariés.</p>

<h2>Module 1 — Cartographier le paysage numérique marocain</h2>
<p>Avant de choisir des outils ou de lancer des campagnes, il faut comprendre le terrain. Ce premier module dresse l'état des lieux de la digitalisation au Maroc en 2026 : taux de pénétration mobile (supérieur à 130\u202f%), profil des acheteurs en ligne, infrastructures de paiement disponibles, et initiatives publiques en cours.</p>
<p>On y analyse en détail la stratégie Maroc Digital, le plan Maroc IA 2030 et leurs implications concrètes pour les PME. L'objectif n'est pas un cours d'économie numérique — c'est de vous donner une lecture claire du marché dans lequel vous opérez pour que chaque décision qui suit soit informée, pas intuitive.</p>

<h2>Module 2 — Marketing digital : acquisition et conversion</h2>
<p>Le marketing digital pour une PME marocaine ne ressemble pas à ce qu'enseignent les cours américains. Les canaux qui convertissent ici sont spécifiques : <strong>WhatsApp Business</strong> est souvent le premier point de contact commercial (pas un chatbot sur un site web), <strong>Google Business Profile</strong> génère plus de trafic local qu'un site mal référencé, et <strong>Instagram</strong> fonctionne comme une vitrine pour les commerces de proximité bien avant Facebook.</p>
<p>Ce module couvre quatre axes :</p>
<ul>
  <li><strong>SEO local</strong> — structurer votre présence Google pour apparaître dans les recherches géolocalisées. Configuration de Google Business Profile, stratégie de mots-clés en darija et français, optimisation technique de base.</li>
  <li><strong>Réseaux sociaux</strong> — calendrier éditorial réaliste pour une équipe de 1 à 3 personnes. Création de contenu avec Canva et les outils d'IA générative. Formats qui fonctionnent au Maroc (Reels, Stories, carrousels éducatifs).</li>
  <li><strong>Publicité payante</strong> — Meta Ads et Google Ads avec des budgets de 500 à 5\u202f000 MAD/mois. Ciblage géographique, audiences similaires, remarketing. Mesure du coût par acquisition réel.</li>
  <li><strong>Email et WhatsApp</strong> — automatisation des relances, catalogues WhatsApp Business, segmentation de base. Conformité CNDP pour la collecte de consentement.</li>
</ul>

<h2>Module 3 — Vente en ligne : canaux, logistique et paiement</h2>
<p>La question n'est plus "faut-il vendre en ligne ?" mais "par quel canal commencer ?". Ce module compare les options disponibles pour une PME marocaine :</p>
<ul>
  <li><strong>Marketplaces existantes</strong> — Jumia, Avito Pro, et pour l'export : Etsy, Amazon FBA. Chaque plateforme a ses frais, ses contraintes logistiques et son profil d'acheteur. On analyse les marges réelles après commissions et livraison.</li>
  <li><strong>Site e-commerce propre</strong> — WooCommerce, Shopify, ou solutions marocaines. Intégration des passerelles de paiement CMI et CashPlus. Coûts de maintenance réalistes.</li>
  <li><strong>Social selling</strong> — vente directe via Instagram et WhatsApp avec gestion de commandes structurée. CRM léger (HubSpot Free, Notion, ou un simple Google Sheet bien organisé) pour suivre les prospects.</li>
  <li><strong>Produits digitaux</strong> — formations en ligne, templates, consulting packagé. Modèle à marge élevée, sans contrainte logistique.</li>
</ul>
<p>Pour chaque canal, on examine un cas concret de PME marocaine : investissement initial, délai avant les premières ventes, et volume nécessaire pour atteindre la rentabilité.</p>

<h2>Module 4 — Développement d'affaires et networking digital</h2>
<p>LinkedIn au Maroc a dépassé le stade du CV en ligne. C'est devenu un outil de prospection B2B redoutable quand on maîtrise trois mécaniques : le profil optimisé pour la recherche (pas une biographie, un argument commercial), la publication régulière de contenu de niche, et l'approche directe par message structuré.</p>
<p>Au-delà de LinkedIn, ce module couvre l'intégration dans l'écosystème entrepreneurial marocain : les communautés actives (StartupMaroc, Endeavor Morocco, les CRI régionaux), les événements hybrides qui génèrent réellement du business, et les partenariats stratégiques entre PME complémentaires. On y aborde aussi la participation aux marchés publics via les plateformes de dématérialisation.</p>

<h2>Module 5 — Productivité et automatisation par l'IA</h2>
<p>Ce module est le plus immédiatement rentable. L'IA générative et les outils no-code permettent aujourd'hui à un dirigeant de PME de réduire de 2 à 3 heures par jour le temps consacré aux tâches administratives et répétitives. Ce n'est pas une projection — c'est une réalité mesurable avec les bons outils.</p>
<p>Concrètement, on met en place :</p>
<ul>
  <li><strong>Suite collaborative</strong> — Google Workspace ou Microsoft 365 configurés pour une équipe de PME. Partage de documents, calendriers partagés, visioconférence.</li>
  <li><strong>Automatisation sans code</strong> — Zapier, Make (ex-Integromat), ou n8n pour connecter vos outils entre eux. Exemple : un formulaire WhatsApp qui alimente automatiquement votre CRM et déclenche un email de suivi.</li>
  <li><strong>Comptabilité digitale</strong> — transition depuis Excel vers un outil structuré, en anticipation de la facturation électronique obligatoire. Sage, Zoho Books, ou solutions locales.</li>
  <li><strong>IA au quotidien</strong> — ChatGPT pour la rédaction commerciale, la synthèse de documents et l'analyse de données. Claude pour le raisonnement complexe et la révision de contrats. Canva AI pour le contenu visuel. Utilisation responsable et limites actuelles.</li>
</ul>

<h2>Module 6 — Ressources humaines et management digital</h2>
<p>Recruter un développeur à Casablanca ne se fait plus en publiant une annonce dans un journal. Les plateformes de recrutement digital (Rekrute, Emploi.ma, LinkedIn Jobs), le employer branding sur les réseaux sociaux, et les processus d'entretien à distance sont devenus la norme pour attirer les talents.</p>
<p>Ce module couvre aussi la formation continue via le e-learning (comment créer un parcours interne sans budget de grande entreprise), la mise en place d'un cadre de télétravail structuré (contrat, outils, indicateurs de performance), et le management d'équipes hybrides. On aborde les aspects juridiques spécifiques au droit du travail marocain pour le travail à distance.</p>

<h2>Module 7 — Cadre juridique marocain du numérique</h2>
<p>C'est le module que personne ne trouve excitant — jusqu'à ce qu'une amende arrive. Le cadre juridique numérique marocain s'est considérablement renforcé et les PME sont désormais dans le viseur des régulateurs :</p>
<ul>
  <li><strong>Loi 09-08 et CNDP</strong> — obligations de déclaration des fichiers de données personnelles, consentement explicite pour la prospection commerciale, droit d'accès et de rectification. Amendes pouvant atteindre 300\u202f000 MAD.</li>
  <li><strong>Loi 31-08</strong> — protection du consommateur dans le commerce électronique. Mentions obligatoires, droit de rétractation, conditions générales de vente conformes.</li>
  <li><strong>Facturation électronique 2026</strong> — calendrier de mise en conformité, formats acceptés par la DGI, solutions certifiées.</li>
  <li><strong>Loi 05-20 sur la cybersécurité</strong> — obligations de sécurité pour les entreprises opérant des systèmes d'information, déclaration d'incidents à la DGSSI.</li>
  <li><strong>Portail directentreprise.ma</strong> — dématérialisation des procédures administratives et création d'entreprise en ligne.</li>
</ul>
<p>Pour chaque texte, on traduit le jargon juridique en actions concrètes : ce que vous devez mettre en place, dans quel délai, et avec quels outils.</p>

<h2>Module 8 — Cybersécurité pour PME</h2>
<p>Les PME représentent 60\u202f% des cibles de cyberattaques, non pas parce qu'elles détiennent les données les plus précieuses, mais parce qu'elles sont les moins protégées. Un ransomware peut paralyser votre activité pendant des semaines. Un phishing réussi peut vider votre compte bancaire professionnel en quelques heures.</p>
<p>Ce module ne vise pas à faire de vous un expert en sécurité informatique. Il vise à mettre en place les protections de base qui bloquent 95\u202f% des attaques courantes :</p>
<ul>
  <li><strong>Hygiène numérique</strong> — politique de mots de passe, authentification à deux facteurs (2FA) sur tous les comptes critiques, sauvegardes automatiques testées.</li>
  <li><strong>Menaces courantes</strong> — identification du phishing, des faux virements (fraude au président), et des arnaques spécifiques au marché marocain.</li>
  <li><strong>Plan de réponse à incident</strong> — les 4 premières heures après une compromission. Qui contacter, quoi isoler, comment communiquer.</li>
  <li><strong>Cyber-assurance</strong> — analyse coût/bénéfice pour une PME marocaine. Ce qui est couvert, ce qui ne l'est pas, et les exclusions classiques.</li>
</ul>

<h2>Module 9 — Plan d'action personnalisé sur 30 jours</h2>
<p>Le dernier module est un atelier pratique. Chaque participant réalise un <strong>auto-diagnostic de maturité digitale</strong> de son entreprise, basé sur une grille couvrant les 8 domaines précédents. Le diagnostic produit un score par domaine et identifie les écarts critiques.</p>
<p>À partir de ce diagnostic, on construit ensemble une matrice effort/impact qui priorise les actions. L'objectif n'est pas de tout faire en un mois — c'est d'identifier les 3 à 5 actions qui auront le plus d'impact avec le moins d'effort, et de les planifier sur un calendrier de 30 jours avec des jalons vérifiables.</p>
<p>Vous repartez avec un document structuré : vos priorités, vos premières actions, les outils sélectionnés, et un calendrier. Le lundi suivant la formation, vous savez exactement par quoi commencer.</p>

<h2>Public cible et prérequis</h2>
<p>Cette formation est conçue pour les dirigeants de PME et TPE marocaines (commerce, services, artisanat, restauration, conseil, industrie), les freelances et auto-entrepreneurs qui veulent structurer leur activité en ligne, et les managers chargés de piloter la transition numérique dans leur organisation.</p>
<p>Aucun prérequis technique n'est nécessaire. Le programme est construit pour des profils business, pas des profils techniques. Si vous utilisez un smartphone et un email, vous avez les bases suffisantes. Chaque concept est illustré par un cas d'usage concret, pas par du code ou des diagrammes d'architecture.</p>

<h2>Ce qui distingue ce programme</h2>
<p>Trois éléments différencient cette formation des ressources disponibles en ligne :</p>
<p><strong>Contextualisation marocaine.</strong> Les exemples, les outils de paiement, le cadre juridique et les canaux de distribution sont spécifiques au Maroc. On parle de CMI et de CashPlus, pas de Stripe et PayPal. De la loi 09-08 et de la CNDP, pas du RGPD. De Jumia et Avito, pas d'eBay.</p>
<p><strong>Approche praticien.</strong> Le programme est conçu et animé par un développeur et entrepreneur qui construit des produits digitaux au quotidien — pas par un consultant qui théorise sur la transformation. Chaque recommandation est testée en conditions réelles sur le marché marocain.</p>
<p><strong>Livrable concret.</strong> Vous ne repartez pas avec une inspiration vague ou une liste de bonnes pratiques. Vous repartez avec un plan d'action daté, priorisé, et adapté à la réalité de votre entreprise.</p>

<div class="formation-downloads">
<h2>Documents de référence</h2>
<p>Consultez le résumé exécutif et le programme détaillé de la formation :</p>
<div class="download-buttons">
<a href="${BRIEF_URL}" class="download-btn" download>
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
Résumé Exécutif (PDF)
</a>
<a href="${TOC_URL}" class="download-btn" download>
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
Programme Complet (PDF)
</a>
</div>
</div>

<h2>Inscription</h2>
<p>Les places sont limitées pour garantir un accompagnement individualisé. Pour vous inscrire ou obtenir des informations complémentaires sur les dates, le format et les tarifs, contactez-moi directement :</p>
<p><strong><a href="mailto:khalil@drissi.org">khalil@drissi.org</a></strong></p>`;

const tags = [
  'Formation',
  'Transformation Digitale',
  'PME Maroc',
  'Marketing Digital',
  'E-commerce',
  'Cybersécurité',
  'IA',
  'Cadre Juridique',
];

const categories = ['Formation', 'Business'];

async function main() {
  console.log('Publishing formation blog post...\n');

  console.log('  Creating tags...');
  const tagIds = [];
  for (const tag of tags) {
    const id = await getOrCreateTerm('tags', tag);
    if (id) tagIds.push(id);
  }
  console.log(`  ✓ ${tagIds.length} tags ready`);

  console.log('  Creating categories...');
  const catIds = [];
  for (const cat of categories) {
    const id = await getOrCreateTerm('categories', cat);
    if (id) catIds.push(id);
  }
  console.log(`  ✓ ${catIds.length} categories ready`);

  console.log('  Uploading featured image...');
  const imageId = await uploadFeaturedImage();

  console.log('  Publishing post...');
  const postData = {
    title,
    slug,
    content,
    excerpt,
    status: 'publish',
    categories: catIds,
    tags: tagIds,
    lang: 'fr',
  };
  if (imageId) postData.featured_media = imageId;

  const post = await wpAPI('POST', 'posts', postData);
  console.log(`\n  ✓ Published: ${post.link}`);
  console.log(`    ID: ${post.id}`);
  console.log(`    Slug: ${post.slug}`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
