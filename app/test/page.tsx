'use client';

import dynamic from 'next/dynamic'

const DynamicHeader = dynamic(() => import('@/components/circuitsim'), {
    ssr: false,
})

export default function Page() {
    return <DynamicHeader />;
}