"use client";
import React from "react";
import Image from "next/image";
import Link from 'next/link';
const BlogSinglePage = () => {
    return (
        <div>
            {/* Bottom Bar */}
            <div className="w-full fixed flex-0 h-20 p-4 bottom-0 justify-center items-center absolute bg-white shadow-[0px_-5px_20px_0px_rgba(9,50,98,0.03)] inline-flex gap-10 overflow-hidden">
                
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

            {/* Main division */}
            <div className="w-full scrollable h-full flex flex-col p-10 gap-10 items-center justify-center bg-neutral-50">
                
                {/*Account profile image*/}
                <div className="w-full px-10 inline-flex flex-row justify-start items-center gap-5">
                    <div className="w-screen flex flex-row, items-center gap-20">
                        <div className="justify-start text-green-800 text-3xl font-semibold font-['Inter']">Hi, Gigi</div>
                        <div className="ml-auto">
                            <img className="w-20 h-20" src="/account-icon.png" />
                        </div>
                    </div>
                </div>

                {/* Search Term Card */}
                <div className="w-full flex flex-col justify-center items-center bg-white rounded-[10px] shadow-[0px_20px_40px_0px_rgba(255,174,0,0.29)] shadow-[0px_5px_10px_0px_rgba(255,174,0,0.26)] overflow-hidden">
                    
                    <div className="self-stretch p-5 flex flex-row gap-5 justify-center items-center">
                        <div className="self-stretch w-full p-2.5 bg-gray-200 rounded-lg inline-flex justify-start items-center gap-2.5">
                            <Image
                                className="black"
                                src="/icons/map.svg"
                                alt="Bus"
                                width={40}
                                height={40}
                            />
                            <div className="w-full justify-center text-neutral-400 text-lg font-['Inter'] truncate">Search station or stop</div>
                        </div>
                        <div className="self-stretch px-5 py-5 bg-gradient-to-br from-green-800 to-green-800 rounded-lg inline-flex justify-center items-center gap-2.5">
                            <Image
                                className="black"
                                src="/icons/search.svg"
                                alt="Bus"
                                width={40}
                                height={40}
                            />
                            <div className="w-full text-center justify-start text-white text-lg font-bold font-['Inter'] leading-4">Find </div>
                        </div>
                    </div>
                    
                    <div className="self-stretch p-5 gap-5 bg-white inline-flex flex-row justify-center items-center">
                        <div className="self-stretch w-full px-2.5 py-2.5 bg-orange-500/10 rounded-lg inline-flex justify-center items-center gap-1.5">
                            <Image
                                className="black"
                                src="/icons/train.svg"
                                alt="Bus"
                                width={40}
                                height={40}
                            />
                            <div className="justify-start text-green-800 text-lg font-bold font-['Inter']">Rail</div>
                        </div>
                        <div className="self-stretch p-2.5 w-full bg-orange-500/10 rounded-lg inline-flex justify-center items-center gap-2.5">
                            <Image
                                className="black"
                                src="/icons/bus_icon.svg"
                                alt="Bus"
                                width={40}
                                height={40}
                            />
                            <div className="justify-start text-green-800 text-lg font-bold font-['Inter']">Bus</div>
                        </div>
                        <div className="self-stretch p-2.5 w-full bg-green-800 rounded-lg inline-flex justify-center items-center gap-2.5">
                            <div className="justify-start text-white text-lg font-bold font-['Inter']">Both</div>
                        </div>
                    </div>
                </div>
                    

                {/* Recently Viewed */}
                <div className="self-stretch h-full text-center justify-center text-green-800 text-2xl font-bold font-['Inter']">Recently Viewed</div>
                <div className="self-stretch h-full flex flex-col justify-center items-center">

                    <div className="self-stretch flex-row p-5 bg-white border border-zinc-100 inline-flex">
                        <div className="self-stretch w-full justify-center items-center text-zinc-600 text-s font-normal font-['Inter']">Lancaster Train Station</div>
                        <Link href="\location-info\train">
                            <div className="ml-auto">
                                <Image
                                    className="black"
                                    src="/icons/arrow_forward.svg"
                                    alt="Bus"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </Link>
                    </div>
                    <div className="self-stretch flex-row p-5 bg-white border-l border-r border-b border-zinc-100 inline-flex flex-col">
                        <div className="self-stretch w-full justify-center items-center text-zinc-600 text-s font-normal font-['Inter']">Preston Train Station</div>
                        <Link href="\location-info\train">
                            <div className="ml-auto">
                                <Image
                                    className="black"
                                    src="/icons/arrow_forward.svg"
                                    alt="Bus"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </Link>
                    </div>
                    <div className="self-stretch flex-row p-5 bg-white border-l border-r border-b border-zinc-100 inline-flex flex-col">
                        <div className="self-stretch w-full justify-center items-center text-zinc-600 text-s font-normal font-['Inter']">Blackpool North</div>
                        <Link href="\location-info\train">
                            <div className="ml-auto">
                                <Image
                                    className="black"
                                    src="/icons/arrow_forward.svg"
                                    alt="Bus"
                                    width={40}
                                    height={40}
                                />
                            </div>
                        </Link>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="self-stretch h-7 px-2.5 inline-flex flex-row justify-start items-start">
                    <div className="self-stretch self-stretch justify-center text-green-800 text-xl font-semibold font-['Inter']">Quick Links </div>
                    <div className="self-stretch self-stretch justify-center ml-auto text-zinc-600 text-base font-medium font-['Inter']">See all</div>
                </div>

                
                <div className="self-stretch grid grid-cols-2 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 pb-20 gap-10 justify-center items-center">
                    <div className="self-stretch w-fill h-fill bg-white rounded-[10px] shadow-[0px_10px_13px_0px_rgba(0,0,0,0.25)] inline-flex flex-col justify-between items-center">
                        <img className="self-stretch h-fill rounded-tl-[10px] rounded-tr-[10px]" src="https://placehold.co/166x110" />
                        <div className="self-stretch h-fill p-2.5 flex flex-col justify-center items-center gap-2.5">
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Lancaster Train Station</div>
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Lancaster</div>
                            <Link href="\location-info\train">
                                <div className="self-stretch p-2.5 bg-green-800 rounded-[5px] inline-flex justify-center items-center">
                                    <div className="text-center justify-start text-white text-base font-medium font-['Inter'] uppercase">Departures</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="self-stretch w-fill h-fill bg-white rounded-[10px] shadow-[0px_10px_13px_0px_rgba(0,0,0,0.25)] inline-flex flex-col justify-between items-center">
                        <img className="self-stretch h-fill rounded-tl-[10px] rounded-tr-[10px]" src="https://placehold.co/166x110" />
                        <div className="self-stretch h-fill p-2.5 flex flex-col justify-center items-center gap-2.5">
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Common Garden Street</div>
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Lancaster</div>
                            <Link href="\location-info\bus">
                                <div className="self-stretch p-2.5 bg-green-800 rounded-[5px] inline-flex justify-center items-center">
                                    <div className="text-center justify-start text-white text-base font-medium font-['Inter'] uppercase">Departures</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="self-stretch w-fill h-fill bg-white rounded-[10px] shadow-[0px_10px_13px_0px_rgba(0,0,0,0.25)] inline-flex flex-col justify-between items-center">
                        <img className="self-stretch h-fill rounded-tl-[10px] rounded-tr-[10px]" src="https://placehold.co/166x110" />
                        <div className="self-stretch h-fill p-2.5 flex flex-col justify-center items-center gap-2.5">
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Morecambe Train Station</div>
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Morecambe</div>
                            <Link href="\location-info\train">
                                <div className="self-stretch p-2.5 bg-green-800 rounded-[5px] inline-flex justify-center items-center">
                                    <div className="text-center justify-start text-white text-base font-medium font-['Inter'] uppercase">Departures</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                    <div className="self-stretch w-fill h-fill bg-white rounded-[10px] shadow-[0px_10px_13px_0px_rgba(0,0,0,0.25)] inline-flex flex-col justify-between items-center">
                        <img className="self-stretch h-fill rounded-tl-[10px] rounded-tr-[10px]" src="https://placehold.co/166x110" />
                        <div className="self-stretch h-fill p-2.5 flex flex-col justify-center items-center gap-2.5">
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Lancaster Bus Station</div>
                            <div className="self-stretch h-fill text-center justify-center text-green-800 text-sm font-semibold font-['Inter']">Lancaster</div>
                            <Link href="\location-info\bus">
                                <div className="self-stretch p-2.5 bg-green-800 rounded-[5px] inline-flex justify-center items-center">
                                    <div className="text-center justify-start text-white text-base font-medium font-['Inter'] uppercase">Departures</div>
                                </div>
                            </Link>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
export default BlogSinglePage;