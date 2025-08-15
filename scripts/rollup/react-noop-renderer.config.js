import alias from "@rollup/plugin-alias";
import { getBaseRollupPlugins, getPackageJSON, resolvePkgPath } from "./utils";
import generatePackageJson from "rollup-plugin-generate-package-json";

const { name, module, peerDependencies } = getPackageJSON("react-noop-renderer");

// react-noop-renderer 包的路径
const pkgPath = resolvePkgPath(name);

// react-noop-renderer 打包后产物的路径
const distPath = resolvePkgPath(name, true);

export default [
  // react-noop-renderer
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${distPath}/index.js`,
        name: 'ReactNoopRenderer',
        format: "umd",
      }
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins({
        typescript: {
          exclude: ['./packages/react-dom/**/*'],
          tsconfigOverride: {
            compilerOptions: {
              paths: {
                hostConfig: [`./${name}/src/hostConfig.ts`]
              }
            }
          }
        }
      }),
      // webpack resolve alias
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: distPath,
        baseContents: ({ name, description, version }) => ({
          name,
          description,
          version,
          peerDependencies: {
            react: version
          },
          main: 'index.js'
        })
      })
    ]
  }
]