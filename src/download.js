const { FiltersDownloader } = require('@adguard/filters-downloader');
const { stripErrorCredentials, stripKnownUrlCredentials } = require('./utils');

/**
 * Downloads the specified source (a URL or a local file path) and
 * resolves all `!#include` directives in it.
 *
 * @param {String} source - URL or local file path of the source.
 * @returns {Promise<Array<String>>} array with the source rules.
 */
async function download(source) {
    try {
        return await FiltersDownloader.download(source, {}, { allowEmptyResponse: true });
    } catch (error) {
        // The downloader gets the original URL so it can send Basic auth, but
        // its errors may contain that URL. Replace the exact source first: a
        // password can contain a literal `@` followed by whitespace, and the
        // generic scanner can leave the rest of such a password in the text.
        // Then sanitize the whole chain before the error leaves the download
        // layer.
        throw stripErrorCredentials(error, [[source, stripKnownUrlCredentials(source)]]);
    }
}

module.exports = {
    download,
};
