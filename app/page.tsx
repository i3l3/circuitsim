"use client";

import dynamic from 'next/dynamic'

const CircuitSim = dynamic(() => import('@/components/circuitsim'), {
    ssr: false,
})

export default function Page() {
    return <CircuitSim />;
}
