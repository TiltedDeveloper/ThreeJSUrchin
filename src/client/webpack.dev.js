const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
    mode: 'development',
    devtool: 'source-map',
    devServer: {
        host: '127.0.0.1',
        port: 'auto',
        static: false,
        hot: false,
        liveReload: true,
        devMiddleware: { publicPath: '/' },
    },
});
