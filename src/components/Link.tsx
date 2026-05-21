import React from 'react'

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: React.ReactNode
}

export function Link({ href, children, ...props }: LinkProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (props.onClick) props.onClick(e)
    // Allow normal navigation for external links
    if (href.startsWith('http') || href.startsWith('mailto')) return
    e.preventDefault()
    window.history.pushState(null, '', href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return <a href={href} onClick={handleClick} {...props}>{children}</a>
}