const path = require('node:path');
const CopyPlugin = require('copy-webpack-plugin');

const root = path.resolve(__dirname, '../..');

module.exports = {
    context: root,
    entry: './src/client/client.ts',
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(png|jpe?g|fbx)$/i,
                type: 'asset/resource',
                generator: { filename: '[name][ext]' },
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.join(root, 'dist/client'),
        clean: true,
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                'index.html', 'style.css', 'CNAME',
                'UrchinFavicon.png', 'Logos/Urchin_Studios_Logo_White.png',
            ].map((filename) => ({
                from: filename,
                to: filename,
                toType: 'file',
                info: { minimized: true },
            })),
        }),
    ],
};
