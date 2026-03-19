module.exports = {
    requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
    cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
};
