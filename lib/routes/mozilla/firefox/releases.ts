import { DataItem, Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { parseDate } from '@/utils/parse-date';
import { load } from 'cheerio';

const FIRST_VERSION_WITH_THE_NEW_RELEASE_NOTES_PAGE = 28;
const BASE_URL = 'https://www.mozilla.org/en-US/firefox';

export const route: Route = {
    path: '/firefox/releases',
    name: 'Mozilla Firefox Release Notes',
    maintainers: ['Lowkaze'],
    handler,
    example: '/mozilla/firefox/releases',
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportRadar: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
};

async function handler() {
    const list: DataItem[] = [];
    const { data: response } = await got(`${BASE_URL}/releases`);
    const $ = load(response);

    for (let li of $('ol.c-release-list > li').toArray()) {
        li = $(li);

        const majorVersion = li.find('strong a').text();
        const majorVersionLink = generateFullUrl(li.find('strong a').attr('href'));

        if (Number.parseInt(majorVersion) < FIRST_VERSION_WITH_THE_NEW_RELEASE_NOTES_PAGE) {
            continue;
        }

        for (let a of li.find('ol li a').toArray().reverse()) {
            a = $(a);

            list.push({
                title: a.text(),
                link: generateFullUrl(a.attr('href')),
            });
        }

        list.push({
            title: majorVersion,
            link: majorVersionLink,
        });
    }

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const { data: response } = await got(item.link);
                const $ = load(response);

                $('img.sidebar-icon').remove();

                item.description = $('.intro > div:nth-child(2)').html() + $('section.c-release-notes').html();
                item.pubDate = parseDate($('p.c-release-date').text());

                return item;
            })
        )
    );

    return {
        title: $('head title').text(),
        link: `${BASE_URL}/releases`,
        item: items,
    };
}

function generateFullUrl(shortUrl: string) {
    return `${BASE_URL}/${shortUrl.split('/').splice(1).join('/')}`;
}
