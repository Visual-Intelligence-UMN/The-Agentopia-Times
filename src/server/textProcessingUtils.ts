export const extractXML = (xmlString: string, tag: string): string => {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
    const match = xmlString.match(regex);
    return match ? match[1].trim() : `[ERROR: <${tag}> not found]`;
};