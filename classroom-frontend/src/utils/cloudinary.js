const cloudinary = {
    config: () => {
        console.warn("Direct Cloudinary SDK uploads are disabled. Use the authenticated backend upload route instead.");
    },
    uploader: {
        upload: async () => {
            throw new Error("File uploads must go through the authenticated backend proxy.");
        }
    }
};

export default cloudinary;