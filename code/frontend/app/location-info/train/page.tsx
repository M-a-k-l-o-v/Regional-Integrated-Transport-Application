"use client";
import React from "react";
import Image from "next/image";
import Link from 'next/link';
const BlogSinglePage = () => {
    return (
        <div>

            <div className="w-screen scrollable h-full flex flex-col p-10 gap-10 items-center justify-center bg-neutral-50">
                
                <div className="w-full h-full p-5 left-0 top-0 absolute inline-flex flex-col justify-start items-start gap-10">
                    
                    {/* Header */}
                    <div className="self-stretch h-10 inline-flex flex-col justify-start items-start">
                        <div className="w-6 h-6 relative overflow-hidden">
                            <div className="w-4 h-3 left-[4px] top-[6px] absolute outline outline-2 outline-offset-[-1px] outline-zinc-600" />
                        </div>
                        <div className="self-stretch self-stretch inline-flex flex-col justify-between items-center">
                            <div className="justify-center text-gray-800 text-base font-semibold font-['Inter'] leading-5">Lancaster Train Station</div>
                            <div className="w-30 h-4 justify-center text-stone-600 text-xs font-semibold font-['Inter'] leading-4">Last updated 17:12</div>
                        </div>
                    </div>

                    {/* Arrivals and Departures Buttons */}
                    <div className="flex w-full gap-5 justify-center items-start self-stretch h-2 rounded-[10px] inline-flex flex-row justify-start items-start">
                        <div className="flex-1 p-4 self-stretch self-stretch bg-green-800 rounded-[10px] inline-flex justify-center items-center gap-1.5 overflow-hidden">
                            <div className="flex justify-center items-center gap-1.5">
                                <div className="text-center justify-start text-white text-base font-medium font-['Inter'] uppercase">Arrivals</div>
                            </div>
                        </div>
                        <div className="flex-1 p-4 self-stretch self-stretch bg-white rounded-[10px] outline outline-2 outline-offset-[-2px] outline-neutral-300 inline-flex justify-center items-center">
                            <div className="text-center justify-start text-zinc-700 text-base font-medium font-['Inter'] uppercase">Departures</div>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="w-full scrollable h-full flex gap-5 flex-col justify-center items-center pb-20">
                        
                        <div className="w-full p-4 opacity-50 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-between items-start gap-3">
                            <div className="self-stretch inline-flex justify-start items-start gap-3">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:00</div>
                                    </div>
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Blackburn</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 opacity-50 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-between items-start gap-3">
                            <div className="self-stretch inline-flex justify-start items-start gap-3">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:10</div>
                                    </div>
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Burnley</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter']">17:20</div>
                                    </div>
                                    <div className="justify-center">
                                        <span className="text-gray-800 text-xs font-semibold font-['Inter']">Preston<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 3 • Northern</span></div>
                                </div>
                                <div className="flex justify-start items-start gap-3">
                                    <div className="p-0.5 bg-blue-600 rounded-md flex justify-start items-start gap-2.5">
                                        <div className="w-5 h-5 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/wheelchair.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                    </div>
                                    <div className="w-28 px-2 py-1 bg-indigo-50 rounded-md flex justify-center items-center gap-2.5">
                                        <div className="justify-center text-blue-600 text-xs font-medium font-['Inter']">Current</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:35</div>
                                    </div>
                                    <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Barrow-in-Furness<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 2 • Northern</span></div>
                                </div>
                                <div className="w-28 px-2 py-1 bg-amber-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-yellow-600 text-xs font-medium font-['Inter'] leading-4">Delayed</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">17:50</div>
                                    </div>
                                    <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Morecambe<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform 2 • Northern</span></div>
                                </div>
                                <div className="w-28 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">18:05</div>
                                    </div>
                                    <div className="justify-center"><span className="text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Blackpool<br/></span><span className="text-gray-800 text-xs font-normal font-['Inter'] leading-4">Platform --- • Avanti West Coast</span></div>
                                </div>
                                <div className="bg-white flex justify-start items-start gap-3">
                                    <div className="w-28 px-2 py-1 bg-rose-200 rounded-md flex justify-center items-center gap-2.5">
                                        <div className="justify-center text-rose-500 text-xs font-medium font-['Inter'] leading-4">Scheduled only</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Reeves Corner</div>
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">Next arrival : Today / 9:35</div>
                                    </div>
                                </div>
                                <div className="w-20 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-zinc-100 flex flex-col justify-start items-start gap-3">
                            <div className="self-stretch inline-flex justify-between items-start">
                                <div className="inline-flex flex-col justify-start items-start gap-3">
                                    <div className="justify-center text-gray-800 text-xs font-semibold font-['Inter'] leading-4">Reeves Corner</div>
                                    <div className="inline-flex justify-center items-start gap-2">
                                        <div className="w-4 h-4 relative overflow-hidden">
                                            <Image
                                                className="black"
                                                src="/icons/clock.svg"
                                                alt="Bus"
                                                width={40}
                                                height={40}
                                            />
                                        </div>
                                        <div className="justify-center text-zinc-600 text-xs font-normal font-['Inter'] leading-4">Next arrival : Today / 9:35</div>
                                    </div>
                                </div>
                                <div className="w-20 px-2 py-1 bg-emerald-100 rounded-md flex justify-center items-center gap-2.5">
                                    <div className="justify-center text-green-500 text-xs font-medium font-['Inter'] leading-4">On time</div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="flex flex-col justify-center items-center bottom-0">
                <div className="w-full h-20 p-2.5 flex-1 fixed bottom-20 z-50 bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] inline-flex flex-col justify-center items-center gap-2.5">
                    <div className="self-stretch h-12 px-5 py-2.5 bg-gradient-to-br from-green-800 to-green-800 rounded-[10px] inline-flex justify-center items-center gap-2.5">
                        <div className="text-center justify-start text-white text-lg font-bold font-['Inter']">View in Real Time</div>
                    </div>
                </div>

                <div className="w-full fixed flex-0 h-20 p-4 z-10 bottom-0 justify-center items-center absolute bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] inline-flex gap-10 overflow-hidden">
                    <div className="inline-flex flex-col justify-center items-center gap-1.5">
                        <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                            <div className="w-6 h-6 relative overflow-hidden">
                                <Image
                                    className="black"
                                    src="/icons/favorite.svg"
                                    alt="Bus"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </div>
                    </div>

                    <Link href="/map">
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <Image
                                        className="black"
                                        src="/icons/map.svg"
                                        alt="Bus"
                                        width={40}
                                        height={40}
                                    />
                                </div>
                            </div>
                        </div>
                    </Link>

                    <Link href="/home">
                        <div className="inline-flex flex-col justify-center items-center gap-1.5">
                            <div className="p-2 bg-green-800 rounded-[10px] inline-flex justify-start items-center gap-2.5">
                                <div className="w-6 h-6 relative overflow-hidden">
                                    <Image
                                        className="black"
                                        src="/icons/home.svg"
                                        alt="Bus"
                                        width={40}
                                        height={40}
                                    />
                                </div>
                            </div>
                        </div>
                    </Link>

                    <div className="inline-flex flex-col justify-center items-center gap-1.5">
                        <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                            <div className="w-6 h-6 relative overflow-hidden">
                                <Image
                                    className="black"
                                    src="/icons/person.svg"
                                    alt="Bus"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="inline-flex flex-col justify-center items-center gap-1.5">
                        <div className="p-1 rounded-lg inline-flex justify-start items-center gap-2.5">
                            <div className="w-6 h-6 relative overflow-hidden">
                                <Image
                                    className="black"
                                    src="/icons/settings.svg"
                                    alt="Bus"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default BlogSinglePage;