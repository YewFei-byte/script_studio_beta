// The landing page data format. A page is JSON, not HTML: a theme, one
// WhatsApp call-to-action used everywhere, and an ordered list of sections.
// The AI fills this in once; every later edit (reorder, swap layout, edit
// text, change colours) is just a change to this object, re-rendered by
// render.js. Plain ESM, shared by the browser and the server.
//
// Every piece of visible text is bilingual: { en: '...', zh: '...' }.

export const LANGS = ['en', 'zh'];

// Icons a features section may use (all present in icons.js).
export const FEATURE_ICONS = [
  'sparkles', 'shield-check', 'leaf', 'clock', 'heart', 'star', 'truck', 'message-circle', 'chart-bar',
  'circle-check', 'gift', 'world', 'bolt', 'users', 'tool', 'home', 'shopping-bag', 'calendar', 'map-pin',
  'phone', 'award', 'thumb-up', 'coin', 'rocket', 'lock', 'school', 'car', 'building-store',
];

export const RADII = ['sharp', 'soft', 'round'];

// type -> what the editor's section library shows, its layout variants, and
// the nav label it contributes (null = not in the nav).
export const SECTION_TYPES = {
  hero: {
    label: 'Hero',
    hint: 'Big headline and the main button',
    variants: [
      { id: 'split', label: 'Text + photo' },
      { id: 'centered', label: 'Centred' },
      { id: 'cover', label: 'Photo background' },
    ],
    nav: null,
  },
  features: {
    label: 'Features',
    hint: 'Why customers choose you',
    variants: [
      { id: 'bento', label: 'Tiles' },
      { id: 'list', label: 'Icon list' },
    ],
    nav: { en: 'Why us', zh: '优势' },
  },
  steps: {
    label: 'How it works',
    hint: '3-4 simple steps',
    variants: [
      { id: 'row', label: 'Row' },
      { id: 'timeline', label: 'Timeline' },
    ],
    nav: { en: 'How it works', zh: '流程' },
  },
  pricing: {
    label: 'Pricing',
    hint: 'Plans or packages',
    variants: [
      { id: 'tiers', label: 'Plans side by side' },
      { id: 'menu', label: 'Price list' },
    ],
    nav: { en: 'Pricing', zh: '价格' },
  },
  testimonials: {
    label: 'Reviews',
    hint: 'What customers say',
    variants: [
      { id: 'cards', label: 'Cards' },
      { id: 'spotlight', label: 'One big quote' },
    ],
    nav: null,
  },
  gallery: {
    label: 'Gallery',
    hint: 'Photos of products or work',
    variants: [
      { id: 'mosaic', label: 'Mosaic' },
      { id: 'strip', label: 'Scrolling strip' },
    ],
    nav: null,
  },
  video: {
    label: 'Video',
    hint: 'YouTube, Vimeo or MP4',
    variants: [{ id: 'wide', label: 'Wide' }],
    nav: null,
    optional: 'video', // only offered when the Brand Kit enables it
  },
  faq: {
    label: 'FAQ',
    hint: 'Common questions',
    variants: [
      { id: 'accordion', label: 'Accordion' },
      { id: 'columns', label: 'Two columns' },
    ],
    nav: { en: 'FAQ', zh: '常见问题' },
  },
  cta: {
    label: 'Call to action',
    hint: 'A final push to message you',
    variants: [
      { id: 'band', label: 'Colour band' },
      { id: 'card', label: 'Card' },
    ],
    nav: null,
  },
  contact: {
    label: 'Contact',
    hint: 'WhatsApp, address and hours',
    variants: [{ id: 'card', label: 'Card' }],
    nav: { en: 'Contact', zh: '联系我们' },
  },
};

export const SECTION_ORDER = Object.keys(SECTION_TYPES);

const L = (en = '', zh = '') => ({ en, zh });

// Starter content when a section is added from the library (before the AI
// or the user fills it in).
export function defaultContent(type) {
  switch (type) {
    case 'hero':
      return { eyebrow: L(), title: L('Your headline here', '在这里写标题'), subtitle: L('One sentence about what you offer.', '一句话介绍您的产品。'), image: null };
    case 'features':
      return {
        title: L('Why customers choose us', '为什么选择我们'),
        intro: L(),
        items: [
          { icon: 'star', title: L('First reason', '第一个理由'), text: L('Say why it matters.', '说明它的重要性。') },
          { icon: 'clock', title: L('Second reason', '第二个理由'), text: L('Say why it matters.', '说明它的重要性。') },
          { icon: 'heart', title: L('Third reason', '第三个理由'), text: L('Say why it matters.', '说明它的重要性。') },
        ],
      };
    case 'steps':
      return {
        title: L('How it works', '如何运作'),
        items: [
          { title: L('Message us', '联系我们'), text: L('Tell us what you need.', '告诉我们您的需求。') },
          { title: L('We prepare it', '我们准备'), text: L('We get everything ready.', '我们安排好一切。') },
          { title: L('You enjoy it', '您来享受'), text: L('Delivered to you.', '送到您手上。') },
        ],
      };
    case 'pricing':
      return {
        title: L('Pricing', '价格'),
        intro: L(),
        plans: [
          { name: L('Basic', '基础'), price: 'RM 99', period: L('per month', '每月'), features: [L('Feature one', '功能一'), L('Feature two', '功能二')], highlighted: false },
          { name: L('Popular', '热门'), price: 'RM 199', period: L('per month', '每月'), features: [L('Everything in Basic', '包含基础版所有功能'), L('Feature three', '功能三')], highlighted: true },
        ],
      };
    case 'testimonials':
      return { title: L('What customers say', '客户评价'), items: [{ quote: L('A short, real quote from a customer.', '一句真实的客户评价。'), name: 'Customer name', role: L('Customer', '客户') }] };
    case 'gallery':
      return { title: L('Gallery', '图库'), images: [] };
    case 'video':
      return { title: L('See it in action', '观看视频'), text: L(), url: '' };
    case 'faq':
      return { title: L('Questions', '常见问题'), items: [{ q: L('A common question?', '常见问题？'), a: L('A clear, short answer.', '简短清楚的回答。') }] };
    case 'cta':
      return { title: L('Ready when you are', '随时为您服务'), text: L('Send us a message and we will reply quickly.', '给我们发信息，我们会尽快回复。'), image: null };
    case 'contact':
      return { title: L('Visit or message us', '欢迎联系我们'), text: L(), address: L(), hours: L(), phone: '', email: '', mapUrl: '' };
    default:
      return {};
  }
}

let idCounter = 0;
export function newSectionId(type) {
  idCounter += 1;
  return `${type}-${Date.now().toString(36)}${idCounter}`;
}

export function createSection(type, variant) {
  const meta = SECTION_TYPES[type];
  if (!meta) throw new Error(`Unknown section type: ${type}`);
  return { id: newSectionId(type), type, variant: variant || meta.variants[0].id, content: defaultContent(type) };
}

// Text for one language, falling back to English (then Chinese).
export function tx(value, lang = 'en') {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.zh || '';
}

export function isEmptyText(value) {
  return !tx(value, 'en').trim() && !tx(value, 'zh').trim();
}

// A ready-to-render example page, used to design and test the renderer
// without calling the AI.
export const SAMPLE_PAGE = {
  version: 1,
  theme: {
    colors: { primary: '#2F8F5B', accent: '#1F3B2D', bg: '#F4F7F2', surface: '#FFFFFF', text: '#1C2A22' },
    fontPair: 'bricolage-dmsans',
    radius: 'soft',
  },
  brand: { name: 'Leafy Co', logoUrl: '' },
  cta: { label: L('Chat on WhatsApp', 'WhatsApp 咨询') },
  whatsapp: { number: '012-345 6789', message: L("Hi Leafy Co, I'd like to order compostable bowls.", '您好 Leafy Co，我想订购可分解餐碗。') },
  sections: [
    {
      id: 'hero-1', type: 'hero', variant: 'split',
      content: {
        eyebrow: L('Compostable packaging', '可分解包装'),
        title: L('Takeaway bowls that never leak', '绝不漏汤的外卖碗'),
        subtitle: L('Hot soup to the doorstep, then back to soil in 60 days. Made in Penang.', '热汤安全送达，60 天内回归土壤。槟城制造。'),
        image: { url: 'https://picsum.photos/seed/leafy-bowl-hero/1200/1000', alt: L('Stack of fibre bowls', '一叠纤维碗') },
      },
    },
    {
      id: 'features-1', type: 'features', variant: 'bento',
      content: {
        title: L('Built for busy kitchens', '专为忙碌厨房打造'),
        intro: L('Swap your plastic without changing how you work.', '无需改变工作方式，轻松告别塑料。'),
        items: [
          { icon: 'shield-check', title: L('Holds hot curry', '盛装热咖喱'), text: L('Tested to 100°C for 3 hours with no softening or leaks.', '100°C 测试 3 小时，不变软不渗漏。') },
          { icon: 'leaf', title: L('Composts in 60 days', '60 天分解'), text: L('Plant fibre, no plastic lining.', '植物纤维，无塑料内膜。') },
          { icon: 'truck', title: L('Next-day delivery', '次日送达'), text: L('Across the Klang Valley and Penang.', '覆盖巴生谷和槟城。') },
        ],
      },
    },
    {
      id: 'steps-1', type: 'steps', variant: 'row',
      content: {
        title: L('Ordering is simple', '订购很简单'),
        items: [
          { title: L('Send a WhatsApp', '发送 WhatsApp'), text: L('Tell us the size and quantity.', '告诉我们尺寸和数量。') },
          { title: L('Get a quote', '获取报价'), text: L('We reply within an hour on weekdays.', '工作日一小时内回复。') },
          { title: L('Receive your stock', '收到货品'), text: L('Delivered the next working day.', '下一个工作日送达。') },
        ],
      },
    },
    {
      id: 'pricing-1', type: 'pricing', variant: 'tiers',
      content: {
        title: L('Simple carton pricing', '简单的整箱价格'),
        intro: L(),
        plans: [
          { name: L('500 ml bowl', '500 ml 碗'), price: 'RM 89', period: L('per carton of 500', '每箱 500 个'), features: [L('Lid included', '附盖'), L('Soup safe', '可装汤')], highlighted: false },
          { name: L('750 ml bowl', '750 ml 碗'), price: 'RM 119', period: L('per carton of 500', '每箱 500 个'), features: [L('Lid included', '附盖'), L('Best for rice meals', '适合饭类')], highlighted: true },
          { name: L('1000 ml bowl', '1000 ml 碗'), price: 'RM 149', period: L('per carton of 400', '每箱 400 个'), features: [L('Lid included', '附盖'), L('Family portions', '家庭分量')], highlighted: false },
        ],
      },
    },
    {
      id: 'testimonials-1', type: 'testimonials', variant: 'cards',
      content: {
        title: L('Trusted by local kitchens', '本地餐馆的信赖之选'),
        items: [
          { quote: L('We switched 3 outlets in one week. Not one leak complaint since.', '一周内换了 3 间分店，至今零漏汤投诉。'), name: 'Tan Wei Ming', role: L('Owner, Ah Ming Noodle House', 'Ah Ming 面家老板') },
          { quote: L('Customers notice. Our delivery reviews went up.', '顾客都注意到了，外卖评价提升了。'), name: 'Nurul Huda', role: L('Manager, Dapur Huda', 'Dapur Huda 经理') },
        ],
      },
    },
    {
      id: 'faq-1', type: 'faq', variant: 'accordion',
      content: {
        title: L('Questions', '常见问题'),
        items: [
          { q: L('Can I use them in the microwave?', '可以微波加热吗？'), a: L('Yes, for up to 3 minutes.', '可以，最多 3 分钟。') },
          { q: L('Do you print logos?', '可以印标志吗？'), a: L('Yes, from 5 cartons. Send us your logo on WhatsApp.', '可以，5 箱起。请通过 WhatsApp 发送标志。') },
          { q: L('Is there a minimum order?', '有最低订购量吗？'), a: L('One carton.', '一箱起。') },
        ],
      },
    },
    {
      id: 'cta-1', type: 'cta', variant: 'band',
      content: { title: L('Try a free sample pack', '免费试用装'), text: L('Five bowls of each size, delivered free to your kitchen.', '每种尺寸五个，免费送到您的厨房。'), image: null },
    },
    {
      id: 'contact-1', type: 'contact', variant: 'card',
      content: {
        title: L('Visit our warehouse', '欢迎参观我们的仓库'),
        text: L(),
        address: L('12 Jalan Perusahaan 3, Bayan Lepas, Penang', '槟城峇六拜 Jalan Perusahaan 3 12号'),
        hours: L('Mon to Sat, 9am to 6pm', '周一至周六 上午9点至下午6点'),
        phone: '04-645 2210', email: 'hello@leafy.my', mapUrl: '',
      },
    },
  ],
};
