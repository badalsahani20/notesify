export const generateObjectId = (): string => {
    const timestamp = Math.floor(new Date().getTime() / 1000).toString(16).padStart(8, '0');
    const machineId = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const processId = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    const counter = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');

    return `${timestamp}${machineId}${processId}${counter}`;
};