import Translate, {translate} from '@docusaurus/Translate'
import {Icon} from '@iconify/react'
import OpenSourceSvg from '@site/static/svg/undraw_open_source.svg'
import SpiderSvg from '@site/static/svg/undraw_spider.svg'
import WebDeveloperSvg from '@site/static/svg/undraw_web_developer.svg'

export type FeatureItem = {
    title: string | React.ReactNode
    description: string | React.ReactNode
    header: React.ReactNode
    icon?: React.ReactNode
}

const FEATURES: FeatureItem[] = [
    {
        title: translate({
            id: 'homepage.feature.developer',
            message: 'Java 后端目前不是全栈工程师',
        }),
        description: (
            <Translate>
                作为一名 Java 后端工程师，秉承着代码和人有一个能跑就行的原则，为项目添砖Java。
            </Translate>
        ),
        header: <WebDeveloperSvg className={'h-auto w-full'} height={150} role="img"/>,
        icon: <Icon icon="logos:java" className="h-4 w-4 text-neutral-500"/>,
    },
    {
        title: translate({
            id: 'homepage.feature.spider',
            message: '会点逆向 & 爬虫',
        }),
        description: (
            <Translate>
                {`没有看不懂的代码，只有不想看的代码。鄙人不才，会点 web 小逆向，我是一个有底线的逆向开发人员！`}
            </Translate>
        ),
        icon: <Icon icon="logos:python" className="h-4 w-4 text-neutral-500"/>,
        header: <SpiderSvg className={'h-auto w-full'} height={150} role="img"/>,
    },
    {
        title: translate({
            id: 'homepage.feature.enthusiast',
            message: '开源爱好者',
        }),
        description: (
            <Translate>
                作为一名开源爱好者，我的任务是学习学习再学习！积极向开源社区大佬看齐！
            </Translate>
        ),
        header: <OpenSourceSvg className={'h-auto w-full'} height={150} role="img"/>,
        icon: <Icon icon="uil:github" className="h-4 w-4 text-neutral-500"/>,
    },
]

export default FEATURES
