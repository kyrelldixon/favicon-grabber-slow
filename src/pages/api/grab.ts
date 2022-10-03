import { NextApiRequest, NextApiResponse } from 'next';
import { Icon, parseFavicon } from 'parse-favicon'
import { z } from 'zod'

const hostnameRegex = new RegExp("^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])\(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))*$")

const querySchema = z.object({
  domain: z.string().min(1).regex(hostnameRegex)
})


export default function grab(req: NextApiRequest, res: NextApiResponse) {
  try {
    const params = querySchema.parse(req.query)
    const pageUrl = `https://${params.domain}`

    const textFetcher = async (url: string) => {
      return fetch(resolveUrl(url, pageUrl)).then(res => res.text())
    }

    const bufferFetcher = async (url: string) => {
      return fetch(resolveUrl(url, pageUrl)).then(res => res.arrayBuffer())
    }

    parseFavicon(params.domain, textFetcher, bufferFetcher).subscribe(icon => {
      const iconWithFullUrl = iconToFullUrl(icon, pageUrl)
      return res.status(200).json(iconWithFullUrl)
    })

  } catch (error) {
    console.error(error)

    return res.status(400).send({
      message: `Invalid domain name: ${req.query.domain}`
    });
  }
}

function resolveUrl(url: string, baseUrl: string) {
  return new URL(url, baseUrl).href
}

function iconToFullUrl(icon: Icon, baseUrl: string): Icon {
  if (icon.url.match(new RegExp("^https?://"))) {
    return icon
  }

  const newIcon: Icon = {
    ...icon,
    url: `${baseUrl}${icon.url}`
  }

  return newIcon
}
