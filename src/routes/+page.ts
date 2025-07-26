// const ssr = false;


export const load = async ({ fetch }) => {
    const req = await fetch('/words.json');
    const words = await req.json()
    return { words }
}