/* eslint-disable no-console */
import { NextApiRequest, NextApiResponse } from 'next'
import { Icon, parseFavicon } from 'parse-favicon'
import { z } from 'zod'
import { firstValueFrom } from 'rxjs'

import * as cache from '@/lib/cache'

const hostnameRegex = new RegExp(
  '^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])(.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]))*$',
)

const domainSchema = z.object({
  domain: z.string().min(1).regex(hostnameRegex, 'Invalid hostname'),
})

const urlSchema = z.object({
  url: z.string().min(1).url('Invalid URL'),
})

const querySchema = z.union([domainSchema, urlSchema])

export default async function grab(req: NextApiRequest, res: NextApiResponse) {
  const params = querySchema.safeParse(req.query)

  if (!params.success) {
    const param = 'domain' in req.query ? 'domain' : 'url'
    return res.status(400).send({
      message: `Invalid ${param} name: ${req.query.domain || req.query.url}`,
    })
  }

  // I'm assuming the domain comes from https even though
  // rarely that may not be the case.
  const pageUrl =
    'domain' in params.data
      ? `https://${params.data.domain}`
      : new URL(params.data.url).origin

  const textFetcher = async (url: string) => {
    return fetch(resolveUrl(url, pageUrl)).then((res) => res.text())
  }

  const bufferFetcher = async (url: string) => {
    return fetch(resolveUrl(url, pageUrl)).then((res) => res.arrayBuffer())
  }

  const hostname =
    'domain' in params.data
      ? params.data.domain
      : new URL(params.data.url).hostname

  // I could probably move this up a little more, but the change should
  // only have a minor performance impact
  const cachedIcon = await cache.get<Icon>(hostname)

  if (cachedIcon !== null) {
    console.log('got cached response')
    return res.status(200).json(cachedIcon)
  }

  try {
    const icon = await firstValueFrom(
      parseFavicon(hostname, textFetcher, bufferFetcher),
    )
    const iconWithFullUrl = iconToFullUrl(icon, pageUrl)

    // I'm caching for a while since it's not likely that URLs
    // will change for a long time
    const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

    console.log('caching', { hostname, iconWithFullUrl, ...req.query })
    await cache.set<Icon>(hostname, iconWithFullUrl, MAX_AGE_SECONDS)

    return res.status(200).json(iconWithFullUrl)
  } catch (error) {
    return res.status(400).json({
      message: `Could not find favicon for ${hostname}. Does this site exist?`,
    })
  }
}

function resolveUrl(url: string, baseUrl: string) {
  return new URL(url, baseUrl).href
}

function iconToFullUrl(icon: Icon, baseUrl: string): Icon {
  if (icon.url.match(new RegExp('^https?://'))) {
    return icon
  }

  const newIcon: Icon = {
    ...icon,
    url: `${baseUrl}${icon.url}`,
  }

  return newIcon
}
