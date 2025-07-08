import type * as Preset from '@docusaurus/preset-classic'
import type { Config } from '@docusaurus/types'
import { themes } from 'prism-react-renderer'
import social from './data/social'


const config: Config = {
    title: 'Silence',
    url: 'https://silence.5277277.xyz',
    baseUrl: '/',
    favicon: 'img/favicon.ico',
    organizationName: 'Silence',
    projectName: 'silenceBlog',
    customFields: {
        bio: 'Coding is half of life, You are the other half.',
        description:
            '个人博客，主要分享编程开发知识和项目，该网站基于 React 驱动的静态网站生成器 Docusaurus 构建。',
    },
    themeConfig: {
        // announcementBar: {
        //   id: 'announcementBar-3',
        //   content: ``,
        // },
        image: 'img/og.png',
        metadata: [
            {
                name: 'author',
                content: 'Silence',
            },
            {
                name: 'keywords',
                content: 'blog, javascript, typescript, node, react, vue, web',
            },
            {
                name: 'keywords',
                content: '编程',
            },
            {
                name: "referrer",
                content: 'no-referrer'
            },
        ],
        docs: {
            sidebar: {
                hideable: true,
            },
        },
        navbar: {
            logo: {
                alt: 'Silence',
                src: 'img/logo.webp',
                srcDark: 'img/logo.webp',
            },
            hideOnScroll: true,
            items: [
                {label: '前端', position: 'left', to: 'docs/web'},
                {label: '后端', position: 'left', to: 'docs/back'},
                {label: '运维', position: 'left', to: 'docs/linux'},
                {label: '博客', position: 'right', to: 'blog'},
                // {label: '项目', position: 'right', to: 'project'},
                // {label: '友链', position: 'right', to: 'friends'},
                {label: '关于', position: 'right', to: 'about'},
                {
                    label: '更多',
                    position: 'right',
                    items: [
                        {label: '归档', to: 'blog/archive'},
                        // {label: '笔记', to: 'docs/skill'},
                        // {label: '工具推荐', to: 'docs/tools'},
                    ],
                },
                {
                    type: 'localeDropdown',
                    position: 'right',
                },
            ],
        },

        footer: {
            style: 'dark',
            links: [
                {
                    title: '学习',
                    items: [
                        {label: '前端', to: 'docs/web'},
                        {label: '后端', to: 'docs/back'},
                        {label: '运维', to: 'docs/linux'},
                    ],
                },
                {
                    title: '社交媒体',
                    items: [
                        {label: '关于我', to: '/about'},
                        {label: 'GitHub', href: social.github.href},
                    ],
                },
            ]
        },
        algolia: {
            appId: 'DL907034HV',
            // search key
            apiKey: 'fb929240fa507e59ebf0318d5833723f',
            indexName: 'develop',
        },
        prism: {
            theme: themes.oneLight,
            darkTheme: themes.oneDark,
            additionalLanguages: ['bash', 'json', 'java', 'python', 'php', 'graphql', 'rust', 'toml', 'protobuf', 'diff'],
            defaultLanguage: 'javascript',
            magicComments: [
                {
                    className: 'theme-code-block-highlighted-line',
                    line: 'highlight-next-line',
                    block: {start: 'highlight-start', end: 'highlight-end'},
                },
                {
                    className: 'code-block-error-line',
                    line: 'This will error',
                },
            ],
        },
        // giscus: {
        //   repo: 'kuizuo/blog',
        //   repoId: 'MDEwOlJlcG9zaXRvcnkzOTc2MjU2MTI=',
        //   category: 'General',
        //   categoryId: 'DIC_kwDOF7NJDM4CPK95',
        //   theme: 'light',
        //   darkTheme: 'dark_dimmed',
        // } satisfies Partial<GiscusConfig>,
        tableOfContents: {
            minHeadingLevel: 2,
            maxHeadingLevel: 4,
        },
        liveCodeBlock: {playgroundPosition: 'top'},
        zoom: {
            selector: '.markdown :not(em) > img',
            background: {
                light: 'rgb(255, 255, 255)',
                dark: 'rgb(50, 50, 50)',
            },
        },
    } satisfies Preset.ThemeConfig,
    headTags: [
        {
            tagName: 'meta',
            attributes: {
                name: 'description',
                content: 'Silence的个人博客',
            },
        },
        {
            tagName: 'meta',
            attributes: {
                name: 'referrer',
                content: 'no-referrer',
            },
        },
    ],
    presets: [
        [
            'classic',
            {
                docs: {
                    path: 'docs',
                    sidebarPath: 'sidebars.ts',
                },
                blog: false,
                theme: {
                    customCss: ['./src/css/custom.css', './src/css/tweet-theme.css'],
                },
                sitemap: {
                    priority: 0.5,
                },
                gtag: {
                    trackingID: 'G-S4SD5NXWXF',
                    anonymizeIP: true,
                },
                debug: process.env.NODE_ENV === 'development',
            } satisfies Preset.Options,
        ],
    ],
    plugins: [
        'docusaurus-plugin-image-zoom',
        '@docusaurus/plugin-ideal-image',
        // ['docusaurus-plugin-baidu-tongji', { token: 'c9a3849aa75f9c4a4e65f846cd1a5155' }],
        [
            '@docusaurus/plugin-pwa',
            {
                debug: process.env.NODE_ENV === 'development',
                offlineModeActivationStrategies: ['appInstalled', 'standalone', 'queryString'],
                pwaHead: [
                    {tagName: 'link', rel: 'icon', href: '/img/logo.png'},
                    {tagName: 'link', rel: 'manifest', href: '/manifest.json'},
                    {tagName: 'meta', name: 'theme-color', content: '#12affa'},
                ],
            },
        ],
        [
            'vercel-analytics',
            {
                debug: process.env.NODE_ENV === 'development',
                mode: 'auto',
            },
        ],
        [
            './src/plugin/plugin-content-blog', // 为了实现全局 blog 数据，必须改写 plugin-content-blog 插件
            {
                path: 'blog',
                // editUrl: ({ locale, blogDirPath, blogPath, permalink }) =>
                //   `https://github.com/kuizuo/blog/edit/main/${blogDirPath}/${blogPath}`,
                editLocalizedFiles: false,
                blogDescription: '代码人生：编织技术与生活的博客之旅',
                blogSidebarCount: 10,
                blogSidebarTitle: 'Silence',
                postsPerPage: 12,
                showReadingTime: true,
                readingTime: ({content, frontMatter, defaultReadingTime}) =>
                    defaultReadingTime({content, options: {wordsPerMinute: 300}}),
                feedOptions: {
                    type: 'all',
                },
            },
        ],
        async function tailwindcssPlugin() {
            return {
                name: 'docusaurus-tailwindcss',
                configurePostCss(postcssOptions) {
                    // Appends TailwindCSS and AutoPrefixer.
                    postcssOptions.plugins.push(require('tailwindcss'))
                    postcssOptions.plugins.push(require('autoprefixer'))
                    return postcssOptions
                },
            }
        },
        async function injectMotto() {
            return {
                name: 'docusaurus-motto',
                injectHtmlTags() {
                    return {
                        headTags: [
                            {
                                tagName: 'script',
                                innerHTML: `
    (${function () {
                                    // console.log(
                                    //   `%c Kz Blog %c https://github.com/kuizuo/blog`,
                                    //   'color: #fff; margin: 1em 0; padding: 5px 0; background: #12affa;',
                                    //   'margin: 1em 0; padding: 5px 0; background: #efefef;',
                                    // )

//       const motto = `
// This Webisite Powered By Kz Blog.
// Written by Docusaurus, Coding with Love.
// --------
// Love what you do and do what you love.
// `
//
//       if (document.firstChild?.nodeType !== Node.COMMENT_NODE) {
//         document.prepend(document.createComment(motto))
//       }
                                }.toString()})();`,
                            },
                        ],
                    }
                },
            }
        },
    ],
    stylesheets: [
        'https://cdn.jsdelivr.net/npm/misans@4.0.0/lib/Normal/MiSans-Normal.min.css',
        'https://cdn.jsdelivr.net/npm/misans@4.0.0/lib/Normal/MiSans-Medium.min.css',
        'https://cdn.jsdelivr.net/npm/misans@4.0.0/lib/Normal/MiSans-Semibold.min.css',
    ],
    i18n: {
        defaultLocale: 'zh-CN',
        locales: ['zh-CN'],
    },
    onBrokenLinks: 'warn',
}

export default config
