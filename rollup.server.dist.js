import resolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {

    //  Our games entry point (edit as required)
    input: [
        './server/index.ts'
    ],

    //  Where the build file is to be generated.
    //  Most games being built for distribution can use iife as the module type.
    //  You can also use 'umd' if you need to ingest your game into another system.
    //  The 'intro' property can be removed if using Phaser 3.21 or above. Keep it for earlier versions.
    output: {
        file: './dist/server.js',
        format: 'iife',
        sourcemap: false,
        intro: 'var global = globalThis;'
    },

    plugins: [
        //  Parse our .ts source files
        resolve({
            extensions: [ '.ts', '.tsx' ]
        }),

        //  See https://www.npmjs.com/package/rollup-plugin-typescript2 for config options
        typescript(),
    ]
};