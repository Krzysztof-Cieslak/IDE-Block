# IDE Block

There's more to our code than just text - almost every single word in source file have some additional meaning. It can be function name, call to the API, language keyword and more.

When we are working with code in our editors we have a lot of features that allow us to understand this additional context - tooltips showing documentation when you put your mouse over some symbol, highlighting showing which tokens are the same symbol, and more. However, when we are reading code on GitHub, we don't have these features.

IDE-Block is a tool that allows you to add these features to your code on GitHub while using GitHub Blocks. The source of information for the block is LSIF file - a standard format for storing code intelligence data. You can generate LSIF file for your project using GitHub Actions and then store it in your repository in special branch. IDE-Block will then use this file to provide additional context to your code.

Example setup (GH Action defintions can be found in `.github/workflows` directory):
* Rust - https://blocks.githubnext.com/Krzysztof-Cieslak/RustSample/
* Go - https://blocks.githubnext.com/Krzysztof-Cieslak/GoSample/
* C# - https://blocks.githubnext.com/Krzysztof-Cieslak/CSharpSample/
* Dart - https://blocks.githubnext.com/Krzysztof-Cieslak/CSharpSample/

## How to contribute

_Imposter syndrome disclaimer_: I want your help. No really, I do.

There might be a little voice inside that tells you you're not ready; that you need to do one more tutorial, or learn another framework, or write a few more blog posts before you can help me with this project.

I assure you, that's not the case.

This project has some clear Contribution Guidelines and expectations that you can [read here](CONTRIBUTING.md).

The contribution guidelines outline the process that you'll need to follow to get a patch merged. By making expectations and process explicit, I hope it will make it easier for you to contribute.

And you don't just have to write code. You can help out by writing documentation, tests, or even by giving feedback about this work. (And yes, that includes giving feedback about the contribution guidelines.)

Thank you for contributing!

## Contributing and copyright

The project is hosted on [GitHub](https://github.com/Krzysztof-Cieslak/IDE-block) where you can [report issues](https://github.com/Krzysztof-Cieslak/IDE-block/issues), participate in [discussions](https://github.com/Krzysztof-Cieslak/IDE-block/discussions), fork
the project and submit pull requests.

The library is available under [MIT license](LICENSE.md), which allows modification and redistribution for both commercial and non-commercial purposes.

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.