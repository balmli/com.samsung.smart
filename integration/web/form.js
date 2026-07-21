(function registerProfileForm(root) {
    async function saveProfileForm(profileForm, save, read = form => Object.fromEntries(new FormData(form))) {
        const profile = read(profileForm);
        await save(profile);
        profileForm.reset();
    }

    root.saveProfileForm = saveProfileForm;
    if (typeof module !== 'undefined') {
        module.exports = {saveProfileForm};
    }
})(globalThis);
